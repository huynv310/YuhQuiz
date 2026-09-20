import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Clock, AlertTriangle, Send, CheckCircle2, XCircle, 
  GripVertical, Award, User, RefreshCw, ArrowLeft, 
  FileText, CheckSquare, ChevronUp, ChevronDown, 
  ZoomIn, ZoomOut, Maximize2, Minimize2, Type, 
  ChevronLeft, ChevronRight, LayoutGrid, Check 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useExamTimer } from '../hooks/useExamTimer';
import { useAntiCheat } from '../hooks/useAntiCheat';
import { useAutoSave } from '../hooks/useAutoSave';
import { logTelemetry, readTelemetry, clearTelemetry } from '../lib/telemetry';
import { Exam } from '../types/exam';
import { saveRescue, removeRescue, downloadRescue } from '../lib/rescue';
import { SolutionView, hasSolution } from './SolutionView';

interface StudentExamRoomProps {
  examId: string;
  studentName: string;
  className: string;
  currentUser?: any;
  onExit: () => void;
  /** Có giá trị = chế độ chỉ xem lại bài đã nộp (không đếm giờ, không sửa, không nộp). */
  reviewSubmissionId?: string;
}

export const StudentExamRoom: React.FC<StudentExamRoomProps> = ({
  examId = '',
  studentName = '',
  className = '',
  currentUser,
  onExit,
  reviewSubmissionId,
}) => {
  const isReview = !!reviewSubmissionId;
  // 1. Quản lý chia đôi màn hình Desktop & Toàn màn hình PDF
  const [splitRatio, setSplitRatio] = useState<number>(55);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  // Xem lại bài trên điện thoại: đề (trên) và phiếu (dưới) chia dọc, mặc định 50/50, kéo được
  const [mobileRatio, setMobileRatio] = useState<number>(50);
  const centerRef = useRef<HTMLDivElement>(null);
  const isMobileReview = isReview && window.innerWidth < 768;
  const [isPdfFullscreen, setIsPdfFullscreen] = useState<boolean>(false);

  // 2. Thu phóng file PDF độc lập (70% - 200%)
  const [pdfZoom, setPdfZoom] = useState<number>(1.0);

  // 3. Thu phóng cỡ chữ toàn trang web (85% - 120%) an toàn không vỡ layout
  const [fontZoom, setFontZoom] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('web_font_zoom');
      if (saved) return parseInt(saved, 10);
    } catch (e) {}
    return 100;
  });

  // Áp dụng cỡ chữ trang web
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
    return () => {
      document.documentElement.style.fontSize = '16px';
    };
  }, [fontZoom]);

  // 4. Quản lý xem trên Mobile: Chế độ Thanh khoanh nhanh (Quick Dock) & Ngăn kéo ma trận câu hỏi
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState<boolean>(false);
  const [isMobileGridOpen, setIsMobileGridOpen] = useState<boolean>(false);
  const [activeMobileQuestion, setActiveMobileQuestion] = useState<number>(1);
  const [activePart2Sub, setActivePart2Sub] = useState<'a' | 'b' | 'c' | 'd'>('a');
  const [useGoogleViewer, setUseGoogleViewerState] = useState<boolean>(() => {
    try { return localStorage.getItem('yq_pdf_viewer') !== 'native'; } catch { return true; }  // mặc định Google Viewer
  });
  const setUseGoogleViewer = (v: boolean) => {
    setUseGoogleViewerState(v);
    try { localStorage.setItem('yq_pdf_viewer', v ? 'google' : 'native'); } catch { /* ignore */ }
  };

  // Khởi tạo token phiên thi an toàn tuyệt đối
  const [sessionToken] = useState<string>(() => {
    const cleanExamId = String(examId || '').trim();
    const cleanStudent = String(studentName || 'HocSinh').trim();
    const cleanClass = String(className || '12A').trim();
    const key = `session_${cleanExamId}_${cleanStudent}_${cleanClass}`;
    
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const newToken = crypto.randomUUID();
    localStorage.setItem(key, newToken);
    return newToken;
  });

  const [startTime] = useState<number>(() => {
    const key = `start_time_${examId}_${sessionToken}`;
    const existing = localStorage.getItem(key);
    if (existing) return parseInt(existing, 10);
    const now = Date.now();
    localStorage.setItem(key, now.toString());
    return now;
  });

  const [answers, setAnswers] = useState<any>(() => {
    const key = `draft_${examId}_${sessionToken}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            part_1: parsed.part_1 || {},
            part_2: parsed.part_2 || {},
            part_3: parsed.part_3 || {},
            timestamps: parsed.timestamps || { part_1: {}, part_2: {}, part_3: {} },
          };
        }
      } catch (e) {}
    }
    return { part_1: {}, part_2: {}, part_3: {}, timestamps: { part_1: {}, part_2: {}, part_3: {} } };
  });

  const [exam, setExam] = useState<Exam | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(isReview);
  const [result, setResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // ANTI-CHEAT: HOÀN TOÀN TẮT KHI ĐÃ NỘP BÀI (!isSubmitted)
  const { cheatCount, totalAwaySecs } = useAntiCheat(!isSubmitted && !isReview, undefined, (reason, away) => {
    logTelemetry(examId, sessionToken, { type: 'violation', reason, away });
  });
  useAutoSave(answers, examId, sessionToken, studentName, className, isSubmitted || isReview, currentUser?.id || null);

  useEffect(() => {
    if (!examId) return;

    async function init() {
      const { data } = await supabase
        .from('public_exams')
        .select('*')
        .eq('id', examId)
        .maybeSingle();

      if (data) {
        setExam(data);

        if (data.end_at && new Date() > new Date(data.end_at)) {
          alert('Kỳ thi này đã kết thúc thời hạn nộp bài!');
        }
      }

      // FETCH THE SUBMISSION (Prioritize by student_id if logged in, fallback to sessionToken)
      let subQuery = supabase
        .from('submissions')
        .select('*')
        .eq('exam_id', examId);
        
      if (isReview && reviewSubmissionId !== 'latest') {
        subQuery = subQuery.eq('id', reviewSubmissionId);
      } else if (isReview && currentUser?.id) {
        subQuery = subQuery.eq('student_id', currentUser.id).eq('status', 'submitted');
      } else {
        subQuery = subQuery.eq('session_token', sessionToken);
      }

      const { data: subRows } = await subQuery.order('submitted_at', { ascending: false, nullsFirst: false }).limit(1);
      const subData = subRows?.[0];

      if (subData) {
        if (subData.status === 'submitted') {
          setIsSubmitted(true);
          setIsMobileSheetOpen(true);
          removeRescue(sessionToken);
          const { data: keys } = await supabase.rpc('get_answer_keys_after_submit', { p_exam_id: examId });
          setResult({
            score: subData.score,
            score_details: subData.score_details,
            answer_keys: keys,
          });
        }
        if (subData.answers) {
          setAnswers((prev: any) => ({
            ...prev,
            ...subData.answers,
            timestamps: subData.answers.timestamps || prev.timestamps,
          }));
        }
      }
    }
    init();
  }, [examId, sessionToken]);

  const [isJittering, setIsJittering] = useState<boolean>(false);
  const [networkError, setNetworkError] = useState<boolean>(false);

  const handleDownloadRescueFile = () => {
    const rec = { examId, examTitle: exam?.title, studentName, className, sessionToken, answers, cheatCount, totalAwaySecs, timestamp: Date.now() };
    saveRescue(rec);
    downloadRescue(rec);
    alert('Đã tải file cứu hộ và lưu bản dự phòng trong máy. Khi có mạng, vào Cổng học sinh → Lịch sử thi để nộp lại, hoặc gửi file này cho giáo viên.');
  };

  // HÀM NỘP BÀI TỔNG THỂ
  const handleFinalSubmit = async (isAutoSubmit = false): Promise<boolean> => {
    if (isSubmitting || isSubmitted) return false;

    // THUẬT TOÁN JITTER: Phân tán tải mạng nếu nộp tự động khi hết giờ
    if (isAutoSubmit) {
      setIsJittering(true);
      const jitterDelay = Math.floor(Math.random() * 30000); // 0-30s
      console.log(`[Jitter] Tạm hoãn nộp bài tự động trong ${jitterDelay}ms để tránh quá tải server.`);
      await new Promise(resolve => setTimeout(resolve, jitterDelay));
      setIsJittering(false);
    }

    setIsSubmitting(true);
    setNetworkError(false);
    try {
      const studentId = currentUser?.id || null;
      const school = currentUser?.school || currentUser?.user_metadata?.school || 'THPT';

      const telemetry = await readTelemetry(examId, sessionToken);

      const { data, error } = await supabase.rpc('submit_and_grade_exam', {
        p_exam_id: examId,
        p_session_token: sessionToken,
        p_student_name: studentName,
        p_class_name: className,
        p_answers: answers,
        p_cheat_count: cheatCount,
        p_total_away_seconds: totalAwaySecs,
        p_student_id: studentId,
        p_school: school,
        p_telemetry: telemetry,
      });

      if (error) throw error;
      clearTelemetry(examId, sessionToken);
      removeRescue(sessionToken);
      setResult(data);
      setIsSubmitted(true);
      setIsMobileSheetOpen(true);
      localStorage.removeItem('active_exam_session');
      return true;
    } catch (err: any) {
      console.error('Lỗi khi nộp bài:', err);
      saveRescue({ examId, examTitle: exam?.title, sessionToken, studentName, className, answers, cheatCount, totalAwaySecs });
      setNetworkError(true);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // TỰ ĐỘNG NỘP BÀI KHI HẾT GIỜ
  const handleTimeOut = useCallback(async () => {
    if (!isSubmitted) {
      const success = await handleFinalSubmit(true);
      if (success) {
        alert('Đã hết thời gian làm bài! Hệ thống đã tự động nộp và chấm điểm bài làm của bạn.');
      }
    }
  }, [isSubmitted, answers, cheatCount, totalAwaySecs]);

  // Nút Quay lại của trình duyệt / vuốt back = rời phòng thi → thu bài, khóa, dừng đếm giờ
  const leaveRef = useRef<() => Promise<void>>(async () => {});
  leaveRef.current = async () => {
    if (!isSubmitted) await handleFinalSubmit();
    onExit();
  };
  useEffect(() => {
    if (isReview) return;
    history.pushState({ yqExam: true }, '');
    const onPop = () => { leaveRef.current(); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [isReview]);

  // TỰ ĐỘNG NỘP BÀI KHI BẤM NÚT QUAY LẠI
  const handleBackClick = async () => {
    if (isSubmitted) {
      onExit();
      return;
    }

    if (confirm('Bạn có chắc muốn rời phòng thi?\nHệ thống sẽ tự động thu bài và chấm điểm những câu bạn đã làm.')) {
      await handleFinalSubmit();
      onExit();
    }
  };

  const duration = exam?.duration_minutes || 0;
  const timeLeft = useExamTimer(duration, `${examId}_${sessionToken}`, handleTimeOut, isSubmitted);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    if (isMobileReview) {
      const rect = centerRef.current?.getBoundingClientRect();
      if (!rect || rect.height <= 0) return;
      const r = ((e.clientY - rect.top) / rect.height) * 100;
      setMobileRatio(Math.min(80, Math.max(20, r)));
      return;
    }
    const ratio = (e.clientX / window.innerWidth) * 100;
    if (ratio >= 25 && ratio <= 75) {
      setSplitRatio(ratio);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}
    setIsDragging(false);
  };

  useEffect(() => {
    const handleGlobalRelease = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalRelease);
    window.addEventListener('pointerup', handleGlobalRelease);
    return () => {
      window.removeEventListener('mouseup', handleGlobalRelease);
      window.removeEventListener('pointerup', handleGlobalRelease);
    };
  }, []);

  const updateAnswer = (part: string, qIdx: number, val: any, subKey?: string) => {
    if (isSubmitted) return;
    const elapsedSecs = Math.max(1, Math.floor((Date.now() - startTime) / 1000));

    setAnswers((prev: any) => {
      const nextPart = { ...(prev[part] || {}) };
      const nextTimestamps = { ...(prev.timestamps || {}) };
      const nextPartTs = { ...(nextTimestamps[part] || {}) };

      if (part === 'part_2' && subKey) {
        nextPart[qIdx] = { ...(nextPart[qIdx] || {}), [subKey]: val };
        nextPartTs[qIdx] = { ...(nextPartTs[qIdx] || {}), [subKey]: elapsedSecs };
      } else {
        nextPart[qIdx] = val;
        nextPartTs[qIdx] = elapsedSecs;
      }

      nextTimestamps[part] = nextPartTs;

      const nextState = {
        ...prev,
        [part]: nextPart,
        timestamps: nextTimestamps,
      };

      localStorage.setItem(`draft_${examId}_${sessionToken}`, JSON.stringify(nextState));
      return nextState;
    });
  };

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!exam) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#FAFAFA] space-y-3 font-sans">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-gray-600">Đang chuẩn bị đề thi...</p>
      </div>
    );
  }

  const p1Count = exam?.config?.sections?.find(s => s.id === 'part_1')?.question_count ?? 0;
  const p2Count = exam?.config?.sections?.find(s => s.id === 'part_2')?.question_count ?? 0;
  const p3Count = exam?.config?.sections?.find(s => s.id === 'part_3')?.question_count ?? 0;
  const totalQuestions = p1Count + p2Count + p3Count;

  const countAnswered = () => {
    let count = 0;
    count += Object.keys(answers?.part_1 || {}).length;
    Object.values(answers?.part_2 || {}).forEach((g: any) => {
      if (g && typeof g === 'object' && Object.keys(g).length === 4) count++;
    });
    count += Object.values(answers?.part_3 || {}).filter(v => Boolean(v)).length;
    return count;
  };

  // Hàm chuyển đổi số thứ tự câu toàn bài (1 .. totalQuestions) sang phần tương ứng
  const getQuestionMeta = (qNum: number) => {
    if (qNum <= p1Count) {
      return { part: 'part_1', subIndex: qNum, partTitle: 'Phần I' };
    } else if (qNum <= p1Count + p2Count) {
      return { part: 'part_2', subIndex: qNum - p1Count, partTitle: 'Phần II' };
    } else {
      return { part: 'part_3', subIndex: qNum - p1Count - p2Count, partTitle: 'Phần III' };
    }
  };

  const currentQMeta = getQuestionMeta(activeMobileQuestion);

  const getPdfEmbedUrl = () => {
    if (!exam?.pdf_url) return '';
    // Thêm #view=FitH để đảm bảo các trình duyệt không bắt tải về mà sẽ render PDF
    if (useGoogleViewer) {
      return `https://docs.google.com/viewer?url=${encodeURIComponent(exam.pdf_url)}&embedded=true`;
    }
    // Dùng object / iframe trực tiếp với param chuẩn
    return `${exam.pdf_url}#view=FitH&zoom=${Math.round(pdfZoom * 100)}&toolbar=0&navpanes=0`;
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#FAFAFA] text-[#121212] font-sans antialiased select-none overflow-hidden relative">
            
      {/* 1. TOP HEADER (ĐƯỢC TỐI ƯU RESPONSIVE CHỐNG CHÈN CHỮ VÀ VỠ BỐ CỤC TRÊN MOBILE) */}
      <header className="h-14 md:h-16 bg-white border-b border-[#EAEAEA] px-2.5 md:px-6 flex items-center justify-between shadow-xs z-30 flex-shrink-0">
        <div className="flex items-center space-x-2 md:space-x-3 overflow-hidden">
          <button 
            onClick={handleBackClick}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all flex-shrink-0"
            title="Quay lại (Tự động nộp bài)"
          >
            <ArrowLeft className="w-4 h-4 text-gray-700" />
          </button>
          
          <div className="flex items-center space-x-2 overflow-hidden">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-primary flex items-center justify-center text-white font-extrabold text-[10px] md:text-[11px] shadow-sm flex-shrink-0">
              {exam?.subject ? exam.subject.slice(0, 2).toUpperCase() : 'EX'}
            </div>
            <div className="overflow-hidden">
              <h1 className="font-extrabold text-xs md:text-sm text-gray-900 truncate max-w-[110px] sm:max-w-[180px] md:max-w-xs leading-tight">
                {exam?.title}
              </h1>
              <div className="flex items-center space-x-1.5 text-[10px] md:text-[11px] text-gray-500 truncate">
                <span className="font-semibold text-gray-800 truncate max-w-[80px] sm:max-w-none">{studentName}</span>
                <span>({className})</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 md:space-x-3 flex-shrink-0">
          {/* THANH TÙY CHỈNH CỠ CHỮ TRANG WEB TRÊN HEADER (ẨN TRÊN MÀN HÌNH QUÁ NHỎ ĐỂ CHỐNG VỠ BỐ CỤC) */}
          <div className="hidden sm:flex items-center space-x-1 bg-gray-100/90 p-1 rounded-xl border border-gray-200 text-xs shadow-2xs" title="Cỡ chữ trang web">
            <button
              type="button"
              onClick={() => handleFontZoom(-5)}
              disabled={fontZoom <= 85}
              className="w-6 h-6 rounded-lg hover:bg-white flex items-center justify-center font-bold text-gray-700 disabled:opacity-30 transition-all"
              title="Giảm cỡ chữ trang web"
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
              className="w-6 h-6 rounded-lg hover:bg-white flex items-center justify-center font-bold text-gray-700 disabled:opacity-30 transition-all"
              title="Tăng cỡ chữ trang web"
            >
              A+
            </button>
          </div>

          {/* CẢNH BÁO RỜI TAB (CHỈ BẬT KHI ĐANG THI, TẮT HOÀN TOÀN KHI ĐÃ NỘP BÀI) */}
          {!isSubmitted ? (
            cheatCount > 0 && (
              <div className="hidden md:flex items-center space-x-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-200">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                <span>Rời tab: {cheatCount}</span>
              </div>
            )
          ) : (
            <div className="hidden md:flex items-center space-x-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px] font-medium">
              <span>Rời tab khi thi: {cheatCount} lần</span>
            </div>
          )}

          {/* ĐỒNG HỒ ĐẾM NGƯỢC */}
          {!isSubmitted ? (
            <div className={`flex items-center space-x-1 px-2 md:px-3 py-1 rounded-full font-mono font-bold text-xs md:text-sm tracking-wider ${
              timeLeft < 300 
                ? 'bg-rose-50 text-rose-600 border border-rose-200 animate-pulse' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              <Clock className="w-3.5 h-3.5 text-gray-600" />
              <span>{formatTimer(timeLeft)}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 bg-gray-100 text-gray-700 px-2 py-1 rounded-full font-bold text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">Đã hoàn thành</span>
            </div>
          )}

          {/* NÚT NỘP BÀI / ĐIỂM SỐ */}
          {!isSubmitted ? (
            <button
              onClick={() => {
                if (confirm('Bạn có chắc chắn muốn nộp bài không?')) {
                  handleFinalSubmit();
                }
              }}
              disabled={isSubmitting || isJittering}
              className={`flex items-center space-x-1 active:scale-95 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-full font-bold text-xs md:text-sm transition-all shadow-sm flex-shrink-0 ${networkError ? 'bg-rose-500 hover:bg-rose-600' : 'bg-primary hover:bg-primary-dark'}`}
            >
              {(isSubmitting || isJittering) ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{isJittering ? 'Chờ tải...' : (networkError ? 'Thử lại' : 'Nộp bài')}</span>
            </button>
          ) : (
            <div className="flex items-center space-x-1 bg-blue-50 text-primary-dark border border-blue-200 px-2.5 py-1 rounded-full font-extrabold text-xs md:text-sm flex-shrink-0">
              <Award className="w-3.5 h-3.5 text-primary" />
              <span>{result?.score}đ</span>
            </div>
          )}
        </div>
      </header>

      {/* HIỂN THỊ CẢNH BÁO MẤT MẠNG VÀ NÚT TẢI FILE CỨU HỘ */}
      {networkError && !isSubmitted && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 flex flex-wrap items-center justify-between z-20">
          <div className="flex items-center space-x-2 text-rose-700 text-xs sm:text-sm font-bold">
            <AlertTriangle className="w-4 h-4" />
            <span>Mất kết nối! Không thể nộp bài lên máy chủ.</span>
          </div>
          <button
            onClick={handleDownloadRescueFile}
            className="mt-2 sm:mt-0 flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
          >
            <span>Tải File Cứu Hộ (.yuhquiz)</span>
          </button>
        </div>
      )}

      {/* 2. KHU VỰC TRUNG TÂM */}
      <div ref={centerRef} className={`flex flex-1 overflow-hidden relative ${isReview ? 'flex-col md:flex-row' : ''}`}>
        
        {/* KHUNG ĐỀ THI PDF CÓ THANH THU PHÓNG ĐỘC LẬP */}
        <div 
          style={isMobileReview
            ? { height: `${mobileRatio}%`, width: '100%', flex: 'none', transition: 'none' }
            : { width: window.innerWidth >= 768 ? (isPdfFullscreen ? '100%' : `${splitRatio}%`) : '100%' }}
          className="h-full bg-[#525659] relative overflow-hidden flex flex-col flex-1 transition-all"
        >
          {/* SUB-HEADER KHUNG ĐỀ THI: CÔNG CỤ ZOOM VÀ ĐỔI VIEWER */}
          <div className="h-8 md:h-9 bg-gray-100 border-b border-gray-200 px-2 md:px-3 flex items-center justify-between text-[11px] text-gray-600 z-10 flex-shrink-0">
            <span className="flex items-center space-x-1 font-semibold">
              <FileText className="w-3.5 h-3.5 text-gray-500" />
              <span className="hidden sm:inline">{useGoogleViewer ? 'Đề thi · Google Viewer' : 'Đề thi · Trình đọc gốc'}</span>
            </span>

            {/* BỘ NÚT THU PHÓNG FILE PDF ĐỘC LẬP (70% - 200%) */}
            <div className="flex items-center space-x-1 bg-white px-2 py-0.5 rounded-lg border border-gray-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setPdfZoom(prev => Math.max(0.7, parseFloat((prev - 0.15).toFixed(2))))}
                disabled={pdfZoom <= 0.7}
                className="w-5 h-5 rounded hover:bg-gray-100 flex items-center justify-center font-bold text-gray-700 disabled:opacity-30"
                title="Thu nhỏ đề thi"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPdfZoom(1.0)}
                className="font-mono text-[11px] font-bold text-primary-dark hover:underline px-1 min-w-[34px] text-center"
                title="Đặt lại cỡ đề về 100%"
              >
                {Math.round(pdfZoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setPdfZoom(prev => Math.min(2.0, parseFloat((prev + 0.15).toFixed(2))))}
                disabled={pdfZoom >= 2.0}
                className="w-5 h-5 rounded hover:bg-gray-100 flex items-center justify-center font-bold text-gray-700 disabled:opacity-30"
                title="Phóng to đề thi"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsPdfFullscreen(!isPdfFullscreen)}
                className="w-5 h-5 rounded hover:bg-gray-100 flex items-center justify-center text-gray-600 ml-1 hidden md:flex"
                title={isPdfFullscreen ? "Thu nhỏ lại chia đôi màn hình" : "Mở rộng đề toàn màn hình"}
              >
                {isPdfFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              onClick={() => setUseGoogleViewer(!useGoogleViewer)}
              className="text-primary hover:underline font-semibold flex items-center space-x-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden md:inline">{useGoogleViewer ? 'Chuyển sang trình đọc gốc' : 'Chuyển sang Google Viewer'}</span>
            </button>
          </div>

          {/* VÙNG CHỨA IFRAME PDF ÁP DỤNG THU PHÓNG THỰC TẾ (CSS TRANSFORM SCALE) */}
          {exam?.config?.question_images?.length ? (
            <div className={`w-full flex-1 overflow-auto bg-[#525659] p-2 space-y-2 ${isDragging ? 'pointer-events-none select-none' : ''}`}>
              {exam.config.question_images.map((url: string, i: number) => (
                <div key={url + i} className="bg-white rounded-lg p-2" style={{ width: `${Math.round(100 * pdfZoom)}%`, minWidth: '100%' }}>
                  <p className="text-xs font-bold text-slate-500 mb-1">Câu {i + 1}</p>
                  <img src={url} alt={`Câu ${i + 1}`} loading="lazy" className="w-full h-auto" draggable={false} />
                </div>
              ))}
            </div>
          ) : exam?.pdf_url ? (
            <div className={`w-full flex-1 relative overflow-auto bg-[#525659] ${isDragging ? 'pointer-events-none select-none' : ''}`}>
              <div 
                style={{
                  width: `${Math.round(100 * pdfZoom)}%`,
                  height: `${Math.round(100 * pdfZoom)}%`,
                  minWidth: '100%',
                  minHeight: '100%',
                  position: 'relative',
                }}
              >
                {useGoogleViewer ? (
                  <iframe
                    src={getPdfEmbedUrl()}
                    title="Đề thi PDF"
                    style={{
                      width: `${(100 / pdfZoom).toFixed(2)}%`,
                      height: `${(100 / pdfZoom).toFixed(2)}%`,
                      transform: `scale(${pdfZoom})`,
                      transformOrigin: 'top left',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      border: 'none',
                    }}
                    allow="autoplay"
                  />
                ) : (
                  <object
                    data={getPdfEmbedUrl()}
                    type="application/pdf"
                    style={{
                      width: `${(100 / pdfZoom).toFixed(2)}%`,
                      height: `${(100 / pdfZoom).toFixed(2)}%`,
                      transform: `scale(${pdfZoom})`,
                      transformOrigin: 'top left',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      border: 'none',
                    }}
                  >
                    <div className="flex flex-col items-center justify-center h-full text-white space-y-3">
                      <p>Trình duyệt của bạn không hỗ trợ đọc PDF trực tiếp.</p>
                      <button onClick={() => setUseGoogleViewer(true)} className="px-4 py-2 bg-primary rounded-full text-white font-bold">Dùng Google Viewer</button>
                    </div>
                  </object>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm">Đang tải đề thi...</p>
            </div>
          )}
        </div>

        {/* THANH CHIA TỈ LỆ DESKTOP */}
        {!isPdfFullscreen && (
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={`hidden md:flex w-2 hover:w-2.5 transition-colors bg-[#F0F0F0] hover:bg-primary cursor-col-resize items-center justify-center relative z-40 touch-none ${
              isDragging ? '!bg-primary w-2.5 shadow-lg ring-2 ring-primary/50' : 'border-x border-[#E0E0E0]'
            }`}
          >
            <div className="w-3.5 h-8 bg-white border border-gray-300 rounded-full flex items-center justify-center shadow-sm pointer-events-none">
              <GripVertical className="w-2.5 h-2.5 text-gray-400" />
            </div>
          </div>
        )}

        {/* THANH CHIA TỈ LỆ DỌC (CHỈ XEM LẠI BÀI TRÊN ĐIỆN THOẠI) */}
        {isMobileReview && (
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={`flex h-4 flex-shrink-0 items-center justify-center cursor-row-resize touch-none z-40 border-y border-gray-300 ${isDragging ? 'bg-primary' : 'bg-[#F0F0F0]'}`}
          >
            <div className="h-1.5 w-12 rounded-full bg-gray-400 pointer-events-none" />
          </div>
        )}

        {isDragging && (
          <div 
            className="fixed inset-0 z-50 cursor-col-resize select-none bg-transparent"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        )}

        {/* ĐỘT PHÁ UX MOBILE: THANH KHOANH ĐÁP ÁN NHANH CỐ ĐỊNH Ở ĐÁY (QUICK ANSWER DOCK) */}
        {/* Giúp học sinh đọc đề trọn vẹn toàn màn hình và bấm đáp án bằng ngón tay cái mà không bị che khuất đề */}
        {!isSubmitted && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 px-3 py-2 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              
              {/* CỤM ĐIỀU HƯỚNG CÂU HỎI */}
              <div className="flex items-center space-x-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveMobileQuestion(prev => Math.max(1, prev - 1))}
                  disabled={activeMobileQuestion <= 1}
                  className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-700 disabled:opacity-30"
                  title="Câu trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div 
                  onClick={() => setIsMobileGridOpen(true)}
                  className="px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-center cursor-pointer"
                  title="Bấm để mở ma trận câu hỏi"
                >
                  <span className="text-[10px] text-primary-dark block font-extrabold uppercase -mb-0.5">
                    {currentQMeta.partTitle}
                  </span>
                  <span className="text-xs font-black text-gray-900">
                    Câu {currentQMeta.subIndex}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveMobileQuestion(prev => Math.min(totalQuestions, prev + 1))}
                  disabled={activeMobileQuestion >= totalQuestions}
                  className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-700 disabled:opacity-30"
                  title="Câu tiếp"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* KHU VỰC CHỌN ĐÁP ÁN CỦA CÂU ĐANG CHỌN (TỰ ĐỘNG THÍCH ỨNG THEO TỪNG PHẦN) */}
              <div className="flex-1 flex items-center justify-center px-1">
                {/* PHẦN I: 4 NÚT TRÒN A, B, C, D BẢN TO DỄ CHẠM */}
                {currentQMeta.part === 'part_1' && (
                  <div className="flex space-x-2">
                    {['A', 'B', 'C', 'D'].map((opt) => {
                      const isSelected = answers?.part_1?.[currentQMeta.subIndex] === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            updateAnswer('part_1', currentQMeta.subIndex, opt);
                            // Tự động nhảy sang câu tiếp theo sau khi chọn
                            if (activeMobileQuestion < totalQuestions) {
                              setActiveMobileQuestion(prev => prev + 1);
                            }
                          }}
                          className={`w-9 h-9 rounded-full border text-xs font-extrabold transition-all active:scale-90 ${
                            isSelected 
                              ? 'bg-primary border-primary text-white shadow-md shadow-emerald-500/30 ring-2 ring-emerald-300' 
                              : 'bg-gray-50 border-gray-300 text-gray-800 hover:bg-gray-100'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* PHẦN II: THIẾT KẾ ĐỘT PHÁ TO RÕ, NÚT ĐÚNG / SAI BẢN TO DỄ CHẠM BẰNG NGÓN CÁI */}
                {currentQMeta.part === 'part_2' && (
                  <div className="flex flex-col items-center w-full max-w-[240px]">
                    {/* HÀNG TRÊN: 4 TAB CHỌN Ý a, b, c, d HIỂN THỊ TRẠNG THÁI */}
                    <div className="flex items-center space-x-1 mb-1">
                      {(['a', 'b', 'c', 'd'] as const).map((sub) => {
                        const val = answers?.part_2?.[currentQMeta.subIndex]?.[sub];
                        const isCurrent = activePart2Sub === sub;
                        let badgeStyle = 'bg-gray-100 text-gray-600 border-gray-200';
                        if (val === true) badgeStyle = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
                        else if (val === false) badgeStyle = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';

                        return (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => setActivePart2Sub(sub)}
                            className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold transition-all ${badgeStyle} ${isCurrent ? 'ring-2 ring-primary shadow-xs scale-105' : ''}`}
                          >
                            {sub.toUpperCase()}: {val === true ? 'Đ' : val === false ? 'S' : '-'}
                          </button>
                        );
                      })}
                    </div>

                    {/* HÀNG DƯỚI: 2 NÚT ĐÚNG / SAI BẢN TO (40PX TOUCH TARGET) CHỐNG BẤM NHẦM */}
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-xs text-gray-700 w-8">
                        Ý {activePart2Sub.toUpperCase()}:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          updateAnswer('part_2', currentQMeta.subIndex, true, activePart2Sub);
                          if (activePart2Sub === 'a') setActivePart2Sub('b');
                          else if (activePart2Sub === 'b') setActivePart2Sub('c');
                          else if (activePart2Sub === 'c') setActivePart2Sub('d');
                          else if (activePart2Sub === 'd' && activeMobileQuestion < totalQuestions) {
                            setActiveMobileQuestion(prev => prev + 1);
                            setActivePart2Sub('a');
                          }
                        }}
                        className={`h-9 px-4 rounded-xl font-extrabold text-xs transition-all active:scale-90 flex items-center justify-center space-x-1 ${
                          answers?.part_2?.[currentQMeta.subIndex]?.[activePart2Sub] === true
                            ? 'bg-primary text-white shadow-md ring-2 ring-emerald-300'
                            : 'bg-emerald-50 text-primary-dark border border-emerald-300 hover:bg-emerald-100'
                        }`}
                      >
                        <span>ĐÚNG</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          updateAnswer('part_2', currentQMeta.subIndex, false, activePart2Sub);
                          if (activePart2Sub === 'a') setActivePart2Sub('b');
                          else if (activePart2Sub === 'b') setActivePart2Sub('c');
                          else if (activePart2Sub === 'c') setActivePart2Sub('d');
                          else if (activePart2Sub === 'd' && activeMobileQuestion < totalQuestions) {
                            setActiveMobileQuestion(prev => prev + 1);
                            setActivePart2Sub('a');
                          }
                        }}
                        className={`h-9 px-4 rounded-xl font-extrabold text-xs transition-all active:scale-90 flex items-center justify-center space-x-1 ${
                          answers?.part_2?.[currentQMeta.subIndex]?.[activePart2Sub] === false
                            ? 'bg-rose-500 text-white shadow-md ring-2 ring-rose-300'
                            : 'bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100'
                        }`}
                      >
                        <span>SAI</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* PHẦN III: Ô NHẬP SỐ */}
                {currentQMeta.part === 'part_3' && (
                  <div className="flex items-center space-x-1 w-full max-w-[170px]">
                    <input
                      type="text"
                      placeholder="Đáp số..."
                      value={answers?.part_3?.[currentQMeta.subIndex] || ''}
                      onChange={(e) => updateAnswer('part_3', currentQMeta.subIndex, e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-xl font-mono text-center font-bold focus:bg-white focus:border-primary focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* NÚT MỞ MA TRẬN / TOÀN BỘ PHIẾU */}
              <button
                type="button"
                onClick={() => setIsMobileGridOpen(true)}
                className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 flex flex-col items-center justify-center relative flex-shrink-0"
                title="Mở ma trận câu hỏi"
              >
                <LayoutGrid className="w-4 h-4 text-primary" />
                <span className="text-[8px] font-bold text-gray-500">{countAnswered()}/{totalQuestions}</span>
              </button>

            </div>
          </div>
        )}

        {/* MODAL MA TRẬN TẤT CẢ CÂU HỎI TRÊN MOBILE (BẤM LÀ NHẢY NGAY ĐẾN CÂU ĐÓ) */}
        {isMobileGridOpen && (
          <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end animate-in fade-in duration-200">
            <div className="bg-white rounded-t-3xl w-full p-4 max-h-[75vh] flex flex-col shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">Ma Trận Câu Hỏi</h3>
                  <p className="text-[11px] text-gray-400">Đã hoàn thành {countAnswered()}/{totalQuestions} câu</p>
                </div>
                <button
                  onClick={() => setIsMobileGridOpen(false)}
                  className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-500 text-xs"
                >
                  ✕
                </button>
              </div>

              {/* LƯỚI TẤT CẢ CÂU HỎI */}
              <div className="flex-1 overflow-y-auto py-3 pr-1 space-y-3 text-xs">
                {p1Count > 0 && (
                  <div>
                    <span className="font-bold text-gray-700 text-[11px] block mb-1.5">Phần I (Trắc nghiệm đơn)</span>
                    <div className="grid grid-cols-6 gap-1.5">
                      {Array.from({ length: p1Count }, (_, i) => i + 1).map((q) => {
                        const ans = answers?.part_1?.[q];
                        const isActive = activeMobileQuestion === q;
                        return (
                          <button
                            key={q}
                            type="button"
                            onClick={() => {
                              setActiveMobileQuestion(q);
                              setIsMobileGridOpen(false);
                            }}
                            className={`p-1.5 rounded-xl border text-center font-bold text-xs transition-all ${
                              ans ? 'bg-primary text-white border-primary' : 'bg-gray-50 border-gray-200 text-gray-700'
                            } ${isActive ? 'ring-2 ring-emerald-400' : ''}`}
                          >
                            <span className="block text-[9px] opacity-75">C{q}</span>
                            <span>{ans || '-'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {p2Count > 0 && (
                  <div>
                    <span className="font-bold text-gray-700 text-[11px] block mb-1.5">Phần II (Đúng/Sai)</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {Array.from({ length: p2Count }, (_, i) => i + 1).map((q) => {
                        const qIndex = p1Count + q;
                        const subGroup = answers?.part_2?.[q] || {};
                        const answeredCount = Object.keys(subGroup).length;
                        const isActive = activeMobileQuestion === qIndex;

                        return (
                          <button
                            key={q}
                            type="button"
                            onClick={() => {
                              setActiveMobileQuestion(qIndex);
                              setIsMobileGridOpen(false);
                            }}
                            className={`p-1.5 rounded-xl border text-center font-bold text-xs transition-all ${
                              answeredCount === 4 ? 'bg-primary text-white border-primary' : answeredCount > 0 ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-gray-50 border-gray-200 text-gray-700'
                            } ${isActive ? 'ring-2 ring-emerald-400' : ''}`}
                          >
                            <span className="block text-[9px] opacity-75">C{q}</span>
                            <span>{answeredCount}/4 ý</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {p3Count > 0 && (
                  <div>
                    <span className="font-bold text-gray-700 text-[11px] block mb-1.5">Phần III (Trả lời ngắn)</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {Array.from({ length: p3Count }, (_, i) => i + 1).map((q) => {
                        const qIndex = p1Count + p2Count + q;
                        const val = answers?.part_3?.[q];
                        const isActive = activeMobileQuestion === qIndex;

                        return (
                          <button
                            key={q}
                            type="button"
                            onClick={() => {
                              setActiveMobileQuestion(qIndex);
                              setIsMobileGridOpen(false);
                            }}
                            className={`p-1.5 rounded-xl border text-center font-bold text-xs truncate transition-all ${
                              val ? 'bg-primary text-white border-primary' : 'bg-gray-50 border-gray-200 text-gray-700'
                            } ${isActive ? 'ring-2 ring-emerald-400' : ''}`}
                          >
                            <span className="block text-[9px] opacity-75">C{q}</span>
                            <span className="truncate">{val || '-'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* NÚT MỞ PHIẾU TRUYỀN THỐNG */}
              <div className="pt-2 border-t border-gray-100 flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileGridOpen(false);
                    setIsMobileSheetOpen(true);
                  }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2.5 rounded-xl font-bold text-xs text-center"
                >
                  Xem toàn bộ phiếu cuộn dọc
                </button>
              </div>
            </div>
          </div>
        )}

        {/* KHUNG PHIẾU LÀM BÀI TRUYỀN THỐNG (DESKTOP HOẶC MODAL KHI NỘP XONG TRÊN MOBILE) */}
        <div 
          style={{ width: window.innerWidth >= 768 ? `${100 - splitRatio}%` : '100%' }} 
          className={`
            ${isMobileReview ? 'relative flex-1 min-h-0 z-20' : 'fixed md:relative bottom-0 left-0 right-0 z-50 md:z-20 transition-transform duration-300 ease-out shadow-2xl md:shadow-none'} bg-[#FAFAFA] overflow-y-auto
            ${isMobileReview ? '' : isMobileSheetOpen ? 'translate-y-0 h-[85vh] md:h-full border-t-2 md:border-t-0 border-primary rounded-t-3xl md:rounded-none' : 'translate-y-full md:translate-y-0 h-0 md:h-full'}
            md:block p-3 md:p-6
          `}
        >
          <div className={`${isMobileReview ? 'hidden' : 'md:hidden flex'} items-center justify-between pb-3 border-b border-gray-200 mb-4 sticky top-0 bg-[#FAFAFA] z-20 pt-1`}>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-sm text-gray-900">Phiếu làm bài chi tiết</span>
              <span className="text-xs font-bold text-gray-500">({countAnswered()}/{totalQuestions} câu)</span>
            </div>
            <button
              onClick={() => setIsMobileSheetOpen(false)}
              className="flex items-center space-x-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded-full text-xs font-bold"
            >
              <span>Thu gọn</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-w-2xl mx-auto space-y-6 pb-28">
            
            {/* THẺ ĐIỂM SAU NỘP */}
            {isSubmitted && (
              <div className="bg-white border border-blue-200 rounded-3xl p-5 shadow-sm text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary" />
                <h3 className="text-base font-bold text-primary-dark">Bạn đã nộp bài thành công!</h3>
                <div className="mt-2 flex items-baseline justify-center space-x-1">
                  <span className="text-3xl md:text-4xl font-extrabold text-primary">{result?.score}</span>
                  <span className="text-xs md:text-sm font-semibold text-gray-500">/ 10.0 điểm</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Xem chi tiết đáp án đúng/sai từng câu để đối chiếu ôn tập. Cảm biến chống gian lận đã được tự động tắt.
                </p>
              </div>
            )}

            {/* PHẦN I */}
            {p1Count > 0 && (
              <section className="bg-white border border-[#EAEAEA] rounded-3xl p-4 md:p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                  <div>
                    <h2 className="font-bold text-sm text-gray-900">PHẦN I. Trắc nghiệm 4 lựa chọn</h2>
                    <p className="text-[11px] text-gray-400">Chọn 1 phương án đúng</p>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full font-bold">
                    {p1Count} câu
                  </span>
                </div>

                <div className="space-y-3">
                  {Array.from({ length: p1Count }, (_, i) => i + 1).map((qIdx) => {
                    const currentChoice = answers?.part_1?.[qIdx];
                    const qDetail = result?.score_details?.part_1?.[qIdx];
                    const correctKey = result?.answer_keys?.part_1?.[qIdx];

                    return (
                      <div key={qIdx} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-none">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs md:text-sm text-gray-800 w-16">Câu {qIdx}:</span>
                          {isSubmitted && (
                            qDetail?.is_correct 
                              ? <span className="inline-flex items-center text-primary text-xs font-bold"><CheckCircle2 className="w-4 h-4 mr-1" /> Đúng</span>
                              : <span className="inline-flex items-center text-rose-500 text-xs font-bold"><XCircle className="w-4 h-4 mr-1" /> Sai (ĐS: {correctKey || '--'})</span>
                          )}
                        </div>

                        <div className="flex space-x-2 md:space-x-3">
                          {['A', 'B', 'C', 'D'].map((opt) => {
                            const isSelected = currentChoice === opt;
                            const isKey = isSubmitted && correctKey === opt;
                            const isWrong = isSubmitted && isSelected && !qDetail?.is_correct;

                            let style = "border-gray-200 text-gray-700 hover:border-gray-400 bg-white active:scale-95";
                            if (isSelected) style = "bg-primary border-primary text-white font-bold shadow-sm";
                            if (isSubmitted) {
                              if (isKey) style = "bg-primary border-primary text-white font-bold ring-2 ring-emerald-300";
                              else if (isWrong) style = "bg-rose-500 border-rose-500 text-white font-bold";
                              else style = "border-gray-100 text-gray-300 opacity-40 bg-white";
                            }

                            return (
                              <button
                                key={opt}
                                disabled={isSubmitted}
                                onClick={() => updateAnswer('part_1', qIdx, opt)}
                                className={`w-8 h-8 md:w-10 md:h-10 rounded-full border text-xs md:text-sm font-bold flex items-center justify-center transition-all ${style}`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* PHẦN II */}
            {p2Count > 0 && (
              <section className="bg-white border border-[#EAEAEA] rounded-3xl p-4 md:p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                  <div>
                    <h2 className="font-bold text-sm text-gray-900">PHẦN II. Trắc nghiệm Đúng / Sai</h2>
                    <p className="text-[11px] text-gray-400">4 ý a, b, c, d xếp dọc • Thang lũy tiến 10% - 25% - 50% - 100%</p>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full font-bold">
                    {p2Count} câu
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {Array.from({ length: p2Count }, (_, i) => i + 1).map((qIdx) => (
                    <div key={qIdx} className="bg-[#FAFAFA] p-3.5 md:p-5 rounded-3xl border border-gray-200/80 shadow-xs flex flex-col justify-between overflow-hidden">
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200/60">
                        <span className="font-extrabold text-sm md:text-base text-gray-900">Câu {qIdx}</span>
                        {isSubmitted ? (
                          <span className="text-xs font-bold text-primary">
                            +{result?.score_details?.part_2?.[qIdx]?.score || 0}đ ({result?.score_details?.part_2?.[qIdx]?.correct_count || 0}/4 ý đúng)
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-400 font-medium">4 ý a, b, c, d</span>
                        )}
                      </div>

                      <div className="space-y-2.5">
                        {['a', 'b', 'c', 'd'].map((sub) => {
                          const val = answers?.part_2?.[qIdx]?.[sub];
                          const isCorrect = result?.score_details?.part_2?.[qIdx]?.details?.[sub];
                          const correctVal = result?.answer_keys?.part_2?.[qIdx]?.[sub];

                          return (
                            <div 
                              key={sub} 
                              className="flex items-center justify-between gap-2 py-2.5 px-3.5 rounded-2xl bg-white border border-gray-200/70 hover:border-gray-300 transition-all shadow-xs overflow-hidden"
                            >
                              <div className="flex items-center space-x-2 flex-wrap gap-y-1 min-w-0">
                                <span className="font-extrabold text-xs sm:text-sm text-gray-800 whitespace-nowrap flex-shrink-0">Ý {sub})</span>
                                {isSubmitted && (
                                  isCorrect ? (
                                    <span className="inline-flex items-center text-primary text-xs font-bold whitespace-nowrap flex-shrink-0">
                                      <CheckCircle2 className="w-4 h-4 mr-1 flex-shrink-0" /> Đúng
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center text-rose-500 text-xs font-bold whitespace-nowrap flex-shrink-0">
                                      <XCircle className="w-4 h-4 mr-1 flex-shrink-0" /> Sai
                                    </span>
                                  )
                                )}

                                {isSubmitted && (
                                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-emerald-50 text-primary-dark border border-emerald-200 whitespace-nowrap flex-shrink-0">
                                    ĐS: {correctVal === true ? 'Đúng' : correctVal === false ? 'Sai' : '--'}
                                  </span>
                                )}
                              </div>

                              <div className="flex-shrink-0 ml-auto">
                                <div className="inline-flex rounded-2xl p-1 bg-gray-100 border border-gray-200/80 space-x-1.5 shadow-2xs">
                                  <button
                                    disabled={isSubmitted}
                                    onClick={() => updateAnswer('part_2', qIdx, true, sub)}
                                    className={`min-w-[55px] sm:min-w-[65px] h-8 sm:h-9 text-xs sm:text-sm font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center space-x-1 whitespace-nowrap flex-shrink-0 ${
                                      val === true 
                                        ? (isSubmitted && !isCorrect ? 'bg-rose-500 text-white' : 'bg-primary text-white shadow-md ring-2 ring-emerald-300')
                                        : (isSubmitted && correctVal === true ? 'border-2 border-primary text-primary bg-emerald-50 font-bold' : 'text-gray-600 hover:text-black hover:bg-white/80')
                                    }`}
                                  >
                                    <span>Đúng</span>
                                  </button>
                                  <button
                                    disabled={isSubmitted}
                                    onClick={() => updateAnswer('part_2', qIdx, false, sub)}
                                    className={`min-w-[55px] sm:min-w-[65px] h-8 sm:h-9 text-xs sm:text-sm font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center space-x-1 whitespace-nowrap flex-shrink-0 ${
                                      val === false 
                                        ? (isSubmitted && !isCorrect ? 'bg-rose-500 text-white' : 'bg-primary text-white shadow-md ring-2 ring-emerald-300')
                                        : (isSubmitted && correctVal === false ? 'border-2 border-rose-500 text-rose-600 bg-rose-50 font-bold' : 'text-gray-600 hover:text-black hover:bg-white/80')
                                    }`}
                                  >
                                    <span>Sai</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* PHẦN III */}
            {p3Count > 0 && (
              <section className="bg-white border border-[#EAEAEA] rounded-3xl p-4 md:p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                  <div>
                    <h2 className="font-bold text-sm text-gray-900">PHẦN III. Trả lời ngắn</h2>
                    <p className="text-[11px] text-gray-400">Điền số hoặc số thập phân</p>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full font-bold">
                    {p3Count} câu
                  </span>
                </div>

                <div className="space-y-3">
                  {Array.from({ length: p3Count }, (_, i) => i + 1).map((qIdx) => {
                    const val = answers?.part_3?.[qIdx] || '';
                    const qDetail = result?.score_details?.part_3?.[qIdx];
                    const correctKey = result?.answer_keys?.part_3?.[qIdx];

                    return (
                      <div key={qIdx} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-none">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs md:text-sm text-gray-800 w-16">Câu {qIdx}:</span>
                          {isSubmitted && (
                            qDetail?.is_correct 
                              ? <CheckCircle2 className="w-4 h-4 text-primary" />
                              : <XCircle className="w-4 h-4 text-rose-500" />
                          )}
                        </div>

                        <div className="flex items-center space-x-2 flex-1 max-w-[220px]">
                          <input
                            type="text"
                            disabled={isSubmitted}
                            placeholder="Điền đáp số..."
                            value={val}
                            onChange={(e) => updateAnswer('part_3', qIdx, e.target.value)}
                            className={`w-full text-xs md:text-sm px-3 py-2 rounded-xl border font-mono text-center transition-all focus:outline-none ${
                              isSubmitted 
                                ? (qDetail?.is_correct ? 'border-primary bg-emerald-50 font-bold' : 'border-rose-300 bg-rose-50')
                                : 'border-gray-200 focus:border-primary bg-white'
                            }`}
                          />
                          {isSubmitted && (
                            <span className="text-xs font-mono font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg whitespace-nowrap">
                              ĐS: {correctKey || '--'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {isSubmitted && result?.answer_keys?.solutions && Object.values(result.answer_keys.solutions).some(hasSolution) && (
              <section className="bg-white border border-[#EAEAEA] rounded-3xl p-4 md:p-5 shadow-sm">
                <h2 className="font-bold text-sm text-gray-900 mb-3">Lời giải chi tiết</h2>
                <div className="space-y-3">
                  {Object.entries(result.answer_keys.solutions).filter(([, v]) => hasSolution(v)).map(([k, v]) => {
                    const n = Number(k);
                    const label = n <= p1Count ? `Câu ${n} (Phần I)` : n <= p1Count + p2Count ? `Câu ${n - p1Count} (Phần II)` : `Câu ${n - p1Count - p2Count} (Phần III)`;
                    return <div key={k} className="border-b border-gray-100 pb-3 last:border-none"><SolutionView solution={v} label={label} /></div>;
                  })}
                </div>
              </section>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};
