import { useEffect, useRef, useCallback } from 'react';
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

  // Ghi nhận giờ bắt đầu ở server (để server kiểm tra thời lượng khi nộp)
  useEffect(() => {
    if (!examId || !sessionToken || isSubmitted) return;
    supabase
      .rpc('start_attempt', {
        p_exam_id: examId,
        p_session_token: sessionToken,
        p_student_name: studentName,
        p_class_name: className,
      })
      .then(() => undefined, () => undefined);
  }, [examId, sessionToken]);

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
}
