import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { saveRescue } from '../lib/rescue';

export function useAutoSave(
  answers: any,
  examId: string,
  sessionToken: string,
  studentName: string,
  className: string,
  isSubmitted: boolean = false,
  studentId?: string | null
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const [serverStartedAt, setServerStartedAt] = useState<string | null>(null);
  const latestAnswers = useRef(answers);
  latestAnswers.current = answers;

  // 1. Lưu bản dự phòng cứu hộ tức thì (0ms)
  // (bản nháp `draft_${examId}_${sessionToken}` đã được StudentExamRoom.updateAnswer ghi trực tiếp,
  //  đồng bộ ngay khi state cập nhật — không lặp lại ở đây)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (examId && sessionToken && !isSubmitted) {
      saveRescue({ examId, sessionToken, studentName, className, answers });
    }
  }, [answers, examId, sessionToken, isSubmitted]);

  // 2. Đồng bộ ngầm lên Supabase (Throttled 1 phút)
  const lastSync = useRef<number>(0);

  const syncToServer = useCallback(() => {
    if (isSubmitted) return;

    const hasData = 
      Object.keys(latestAnswers.current?.part_1 || {}).length > 0 ||
      Object.keys(latestAnswers.current?.part_2 || {}).length > 0 ||
      Object.keys(latestAnswers.current?.part_3 || {}).length > 0;

    if (!hasData) return;

    const now = Date.now();
    const timeSinceLastSync = now - lastSync.current;
    
    // Nếu chưa đủ 60s, đặt timeout cho phần dư
    if (timeSinceLastSync < 60000) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(async () => {
        if (isSubmitted) return;
        try {
          lastSync.current = Date.now();
          await supabase.rpc('save_draft', {
            p_exam_id: examId,
            p_session_token: sessionToken,
            p_student_name: studentName,
            p_class_name: className,
            p_answers: latestAnswers.current,
          });
        } catch (err) {
          console.warn('Tạm mất kết nối mạng, bài làm vẫn được bảo vệ tại LocalStorage.');
        }
      }, 60000 - timeSinceLastSync);
      return;
    }

    // Nếu đã đủ 60s, chạy luôn
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Chạy bất đồng bộ
    (async () => {
      if (isSubmitted) return;
      try {
        lastSync.current = Date.now();
        await supabase.rpc('save_draft', {
            p_exam_id: examId,
            p_session_token: sessionToken,
            p_student_name: studentName,
            p_class_name: className,
            p_answers: latestAnswers.current,
          });
      } catch (err) {
        console.warn('Tạm mất kết nối mạng, bài làm vẫn được bảo vệ tại LocalStorage.');
      }
    })();
  }, [examId, sessionToken, studentName, className, isSubmitted, studentId]);

  // Ghi nhận giờ bắt đầu ở server (để server kiểm tra thời lượng khi nộp, và để giáo viên
  // cứu hộ được nếu mất mạng giữa chừng). Gọi 1 lần lúc mất mạng thoáng qua ngay khi mở đề sẽ
  // thất bại và không tự thử lại — thử lại định kỳ tới khi thành công, để một lần mất mạng
  // ngắn (rồi có mạng lại trong lúc làm bài) vẫn kịp ghi được dòng submissions.
  useEffect(() => {
    if (!examId || !sessionToken || isSubmitted) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const tryStart = () => {
      supabase
        .rpc('start_attempt', {
          p_exam_id: examId,
          p_session_token: sessionToken,
          p_student_name: studentName,
          p_class_name: className,
        })
        .then(
          ({ data, error }) => {
            if (cancelled) return;
            if (error) { retryTimer = setTimeout(tryStart, 15000); return; }
            if (data?.started_at) setServerStartedAt(data.started_at);
            if (data?.rescue_secret) saveRescue({ examId, sessionToken, rescueSecret: data.rescue_secret });
          },
          () => {
            if (!cancelled) retryTimer = setTimeout(tryStart, 15000);
          }
        );
    };
    tryStart();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [examId, sessionToken, isSubmitted]);

  useEffect(() => {
    if (isSubmitted) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }
    syncToServer();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [answers, isSubmitted, syncToServer]);

  return serverStartedAt;
}
