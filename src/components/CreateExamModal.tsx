import React, { useState, useEffect } from 'react';
import { 
  X, Upload, Check, RefreshCw, Calendar, Clock, AlertTriangle, 
  Sparkles, FileText, ClipboardList, Lock, Globe, Users, Settings2, Sliders 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SUBJECT_PRESETS, MAX_QUESTION_LIMITS, GRADES } from '../constants/subjectPresets';
import { parseBatchAnswerText } from '../utils/answerParser';

interface CreateExamModalProps {
  currentUser?: any;
  examToEdit?: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateExamModal: React.FC<CreateExamModalProps> = ({
  currentUser,
  examToEdit,
  onClose,
  onSuccess,
}) => {
  const isEditing = Boolean(examToEdit);

  const [title, setTitle] = useState(examToEdit?.title || '');
  const [subject, setSubject] = useState(examToEdit?.subject || 'Toán');
  const [grade, setGrade] = useState<number | ''>(examToEdit?.grade ?? '');
  const [teacherName, setTeacherName] = useState(
    examToEdit?.teacher_name || currentUser?.full_name || currentUser?.user_metadata?.full_name || 'Thầy Nguyễn Văn A'
  );
  const [duration, setDuration] = useState<number>(examToEdit?.duration_minutes || 90);
  const [pdfUrl, setPdfUrl] = useState(examToEdit?.pdf_url || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cấu hình số câu & điểm chuẩn ban đầu
  const initialPreset = SUBJECT_PRESETS[examToEdit?.subject || 'Toán'] || SUBJECT_PRESETS['Toán'];
  
  const [p1Count, setP1Count] = useState<number>(
    examToEdit?.config?.sections?.[0]?.question_count ?? initialPreset.p1Count
  );
  const [p2Count, setP2Count] = useState<number>(
    examToEdit?.config?.sections?.[1]?.question_count ?? initialPreset.p2Count
  );
  const [p3Count, setP3Count] = useState<number>(
    examToEdit?.config?.sections?.[2]?.question_count ?? initialPreset.p3Count
  );

  const [p1TotalScore, setP1TotalScore] = useState<number>(
    examToEdit?.config?.sections?.[0]?.total_score ?? initialPreset.p1Score
  );
  const [p2TotalScore, setP2TotalScore] = useState<number>(
    examToEdit?.config?.sections?.[1]?.total_score ?? initialPreset.p2Score
  );
  const [p3TotalScore, setP3TotalScore] = useState<number>(
    examToEdit?.config?.sections?.[2]?.total_score ?? initialPreset.p3Score
  );

  // Đặt lịch mở & đóng đề
  const [hasTimeLimit, setHasTimeLimit] = useState<boolean>(
    Boolean(examToEdit?.start_at || examToEdit?.end_at)
  );
  const [startAt, setStartAt] = useState<string>(
    examToEdit?.start_at ? new Date(examToEdit.start_at).toISOString().slice(0, 16) : ''
  );
  const [endAt, setEndAt] = useState<string>(
    examToEdit?.end_at ? new Date(examToEdit.end_at).toISOString().slice(0, 16) : ''
  );

  // Chế độ Public vs Private giao theo lớp
  const [isPrivate, setIsPrivate] = useState<boolean>(examToEdit?.is_private || false);
  const [availableClassrooms, setAvailableClassrooms] = useState<any[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  // Bảng tùy chỉnh nâng cao số câu và điểm
  const [showScoreCustomizer, setShowScoreCustomizer] = useState<boolean>(false);

  // Đáp án chuẩn
  const [answerKeys, setAnswerKeys] = useState<{
    part_1: Record<number, string>;
    part_2: Record<number, Record<string, boolean>>;
    part_3: Record<number, string>;
  }>({
    part_1: examToEdit?.answer_keys?.part_1 || {},
    part_2: examToEdit?.answer_keys?.part_2 || {},
    part_3: examToEdit?.answer_keys?.part_3 || {},
  });

  // Chế độ dán đáp án hàng loạt
  const [batchMode, setBatchMode] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null);

  // Tải danh sách lớp học của giáo viên
  useEffect(() => {
    async function fetchClasses() {
      if (!currentUser?.id) return;
      const { data } = await supabase
        .from('classrooms')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .order('name');
      if (data) setAvailableClassrooms(data);

      if (examToEdit?.id) {
        const { data: assigned } = await supabase
          .from('exam_assignments')
          .select('class_id')
          .eq('exam_id', examToEdit.id);
        if (assigned) {
          setSelectedClassIds(assigned.map((a: any) => a.class_id));
        }
      }
    }
    fetchClasses();
  }, [currentUser, examToEdit]);

  // SỬA LỖI PRESET: Tự nạp chuẩn số câu, thời gian và điểm chuẩn khi đổi môn học
  const handleSubjectChange = (newSubject: string) => {
    setSubject(newSubject);
    const preset = SUBJECT_PRESETS[newSubject];
    if (preset) {
      setDuration(preset.duration);
      setP1Count(Math.min(preset.p1Count, MAX_QUESTION_LIMITS.P1_MAX));
      setP2Count(preset.p2Count);
      setP3Count(preset.p3Count);

      setP1TotalScore(preset.p1Score);
      setP2TotalScore(preset.p2Score);
      setP3TotalScore(preset.p3Score);
    }
  };

  // Upload PDF
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Chỉ cho phép tải lên tệp định dạng PDF!');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert('Tệp PDF vượt quá 15MB. Vui lòng nén file hoặc dán link Google Drive.');
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const filePath = `exams/${fileName}`;

      // Tên file duy nhất vĩnh viễn (timestamp + random), không bao giờ bị ghi đè
      // nên cache dài hạn an toàn — tránh học sinh phải tải lại PDF nhiều lần.
      const { error: uploadError } = await supabase.storage
        .from('exam-pdfs')
        .upload(filePath, file, { cacheControl: '31536000', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('exam-pdfs')
        .getPublicUrl(filePath);

      setPdfUrl(publicUrl);
    } catch (err: any) {
      alert('Lỗi tải file: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Phân tích và cập nhật ngay vào bảng đáp án bên dưới
  const handleBatchParse = () => {
    const parsed = parseBatchAnswerText(batchText, { p1: p1Count, p2: p2Count, p3: p3Count });
    if (parsed.errors.length > 0) {
      alert('Lỗi: ' + parsed.errors.join(', '));
      return;
    }

    // CẬP NHẬT TRẠNG THÁI Ô ĐÁP ÁN BÊN DƯỚI ĐỂ GIÁO VIÊN CHECK LẠI
    setAnswerKeys({
      part_1: { ...parsed.part_1 },
      part_2: { ...parsed.part_2 },
      part_3: { ...parsed.part_3 },
    });

    let msg = `✓ Đã nhận diện: ${parsed.summary.p1Count}/${p1Count} câu Phần I, ${parsed.summary.p2Count}/${p2Count} câu Phần II, ${parsed.summary.p3Count}/${p3Count} câu Phần III. Các ô bên dưới đã được điền tự động!`;
    if (parsed.warnings.length > 0) {
      msg += ' (' + parsed.warnings.join(' ') + ')';
    }
    setBatchFeedback(msg);
  };

  const handleFillSampleBatch = () => {
    let sample = '';
    if (p1Count > 0) {
      const p1List = Array.from({ length: p1Count }, (_, i) => `${i + 1}A`).join(' ');
      sample += `PHẦN I: ${p1List}\n`;
    }
    if (p2Count > 0) {
      const p2List = Array.from({ length: p2Count }, (_, i) => `${i + 1}:DDDD`).join(' ');
      sample += `PHẦN II: ${p2List}\n`;
    }
    if (p3Count > 0) {
      const p3List = Array.from({ length: p3Count }, (_, i) => `${i + 1}:1.5`).join(' ');
      sample += `PHẦN III: ${p3List}`;
    }
    setBatchText(sample.trim());
  };

  const updateKey = (part: 'part_1' | 'part_2' | 'part_3', qIdx: number, val: any, subKey?: string) => {
    setAnswerKeys(prev => {
      const nextPart: Record<number, any> = { ...(prev[part] || {}) };
      if (part === 'part_2' && subKey) {
        nextPart[qIdx] = { ...(nextPart[qIdx] || {}), [subKey]: val };
      } else {
        nextPart[qIdx] = val;
      }
      return { ...prev, [part]: nextPart };
    });
  };

  // BẮT BUỘC GIÁO VIÊN PHẢI NHẬP TOÀN BỘ ĐÁP ÁN MỚI CHO PHÉP TẠO ĐỀ
  const validateCompleteAnswers = () => {
    if (p1Count > 0) {
      const missingP1: number[] = [];
      for (let q = 1; q <= p1Count; q++) {
        if (!answerKeys.part_1[q] || !['A', 'B', 'C', 'D'].includes(answerKeys.part_1[q])) {
          missingP1.push(q);
        }
      }
      if (missingP1.length > 0) {
        alert(`Chưa nhập đủ đáp án Phần I! Vui lòng chọn đáp án cho ${missingP1.length} câu còn thiếu: Câu ${missingP1.join(', ')}.`);
        return false;
      }
    }

    if (p2Count > 0) {
      const missingP2: string[] = [];
      for (let q = 1; q <= p2Count; q++) {
        for (const sub of ['a', 'b', 'c', 'd']) {
          if (answerKeys.part_2[q]?.[sub] === undefined || answerKeys.part_2[q]?.[sub] === null) {
            missingP2.push(`C${q}${sub}`);
          }
        }
      }
      if (missingP2.length > 0) {
        alert(`Chưa nhập đủ đáp án Đúng/Sai Phần II! Vui lòng chọn Đúng hoặc Sai cho các ý: ${missingP2.join(', ')}.`);
        return false;
      }
    }

    if (p3Count > 0) {
      const missingP3: number[] = [];
      for (let q = 1; q <= p3Count; q++) {
        if (!answerKeys.part_3[q] || String(answerKeys.part_3[q]).trim() === '') {
          missingP3.push(q);
        }
      }
      if (missingP3.length > 0) {
        alert(`Chưa nhập đủ đáp án Phần III! Vui lòng điền đáp số cho ${missingP3.length} câu còn thiếu: Câu ${missingP3.join(', ')}.`);
        return false;
      }
    }

    return true;
  };

  const totalScoreCalc = (p1TotalScore + p2TotalScore + p3TotalScore).toFixed(2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !pdfUrl.trim()) {
      alert('Vui lòng nhập tên đề thi và cung cấp file PDF!');
      return;
    }

    if (grade === '' || grade < 1 || grade > 12) {
      alert('Vui lòng chọn khối lớp (1 – 12) cho đề thi!');
      return;
    }
    if (p1Count > 100 || p2Count > 100 || p3Count > 100) {
      alert('Mỗi phần tối đa 100 câu!');
      return;
    }

    if (isPrivate && selectedClassIds.length === 0) {
      alert('Bạn đã chọn chế độ "Riêng tư theo lớp", vui lòng tích chọn ít nhất 1 lớp học!');
      return;
    }

    if (!validateCompleteAnswers()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const configPayload = {
        sections: [
          { id: 'part_1', title: 'Trắc nghiệm 4 lựa chọn', question_count: p1Count, total_score: p1TotalScore },
          { id: 'part_2', title: 'Trắc nghiệm Đúng / Sai', question_count: p2Count, total_score: p2TotalScore },
          { id: 'part_3', title: 'Trả lời ngắn', question_count: p3Count, total_score: p3TotalScore },
        ]
      };

      const examPayload = {
        title: title.trim(),
        subject,
        grade,
        teacher_name: teacherName.trim() || 'Thầy Nguyễn Văn A',
        created_by: currentUser?.id || null,
        duration_minutes: duration,
        pdf_url: pdfUrl.trim(),
        config: configPayload,
        start_at: hasTimeLimit && startAt ? new Date(startAt).toISOString() : null,
        end_at: hasTimeLimit && endAt ? new Date(endAt).toISOString() : null,
        is_private: isPrivate,
        updated_at: new Date().toISOString(),
      };

      let examId = examToEdit?.id;

      if (isEditing) {
        const { error } = await supabase.from('exams').update(examPayload).eq('id', examId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('exams').insert(examPayload).select().single();
        if (error) throw error;
        examId = data.id;
      }

      if (examId) {
        const { error: keyError } = await supabase.from('exam_answer_keys').upsert({
          exam_id: examId,
          part_1_keys: answerKeys.part_1,
          part_2_keys: answerKeys.part_2,
          part_3_keys: answerKeys.part_3,
          updated_at: new Date().toISOString(),
        });
        if (keyError) throw keyError;

        await supabase.from('exam_assignments').delete().eq('exam_id', examId);
        if (selectedClassIds.length > 0) {
          const assignRows = selectedClassIds.map(classId => ({
            exam_id: examId,
            class_id: classId,
            start_at: hasTimeLimit && startAt ? new Date(startAt).toISOString() : null,
            end_at: hasTimeLimit && endAt ? new Date(endAt).toISOString() : null,
          }));
          await supabase.from('exam_assignments').insert(assignRows);
        }
      }

      alert(isEditing ? 'Đã cập nhật kỳ thi thành công!' : 'Đã tạo kỳ thi mới thành công!');
      onSuccess();
    } catch (err: any) {
      alert('Không thể lưu kỳ thi: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 yq-overlay z-50 flex items-center justify-center p-4 font-sans text-[#121212]">
      <div className="glass-panel rounded-3xl max-w-3xl w-full p-6 max-h-[92vh] flex flex-col shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="pb-3 border-b border-gray-100">
          <h3 className="font-extrabold text-base md:text-lg text-gray-900 leading-tight">
            {isEditing ? 'Chỉnh Sửa Kỳ Thi' : 'Thiết Lập Kỳ Thi & Preset Đa Môn Học'}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Tự động cấu hình chuẩn theo quy chế Bộ Giáo dục & Đào tạo từ 2025
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4 text-xs pr-1">
          {/* HÀNG 1: TÊN ĐỀ & GIÁO VIÊN */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="font-bold text-gray-700 block mb-1">Tên kỳ thi / Đề thi *</label>
              <input
                type="text"
                required
                placeholder="VD: Khảo Sát Chất Lượng Đầu Năm Môn Toán 12"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">Thầy / Cô giao đề</label>
              <input
                type="text"
                placeholder="VD: Thầy Nguyễn Văn A"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* HÀNG 2: MÔN HỌC & THỜI GIAN */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="font-bold text-gray-700 block mb-1">Môn học thi (Preset tự động) *</label>
              <select
                value={subject}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary font-bold text-gray-900"
              >
                {Object.keys(SUBJECT_PRESETS).map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-gray-700 block mb-1">Khối lớp *</label>
              <select
                required
                value={grade}
                onChange={(e) => setGrade(e.target.value ? parseInt(e.target.value, 10) : '')}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary font-bold text-gray-900"
              >
                <option value="">— Chọn khối —</option>
                {GRADES.map(g => <option key={g} value={g}>Khối {g}</option>)}
              </select>
            </div>

            <div>
              <label className="font-bold text-gray-700 block mb-1">Thời gian làm bài (Phút)</label>
              <input
                type="number"
                required
                min={5}
                max={180}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary font-mono text-center font-bold"
              />
            </div>

            <div className="bg-emerald-50/70 p-2 rounded-xl border border-emerald-200 text-center">
              <span className="text-[10px] text-gray-500 uppercase block font-bold">Thang điểm tổng</span>
              <span className="text-base font-extrabold text-primary-dark">
                {totalScoreCalc} điểm
              </span>
            </div>
          </div>

          {/* HÀNG 3: TÙY CHỈNH NÂNG CAO SỐ CÂU & ĐIỂM TỪNG PHẦN */}
          <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-800 flex items-center space-x-1.5">
                <Sliders className="w-4 h-4 text-primary" />
                <span>Cấu hình số câu & điểm từng phần (Tùy biến thang đo)</span>
              </span>
              <button
                type="button"
                onClick={() => setShowScoreCustomizer(!showScoreCustomizer)}
                className="text-xs text-primary-dark hover:underline font-bold"
              >
                {showScoreCustomizer ? 'Thu gọn' : 'Tùy chỉnh số câu/điểm'}
              </button>
            </div>

            {showScoreCustomizer && (
              <div className="pt-2 border-t border-gray-200 space-y-3 animate-in fade-in duration-200">
                {/* PHẦN I CUSTOM */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-gray-200 items-center">
                  <span className="font-bold text-gray-700">Phần I (Trắc nghiệm 4 lựa chọn)</span>
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-500 text-[11px]">Số câu:</span>
                    <input
                      type="number"
                      min={0}
                      max={MAX_QUESTION_LIMITS.P1_MAX}
                      value={p1Count}
                      onChange={(e) => setP1Count(Math.min(MAX_QUESTION_LIMITS.P1_MAX, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                      className="w-16 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold font-mono"
                    />
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-500 text-[11px]">Tổng điểm:</span>
                    <input
                      type="number"
                      step={0.25}
                      min={0}
                      value={p1TotalScore}
                      onChange={(e) => setP1TotalScore(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-16 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold font-mono text-primary"
                    />
                    <span className="text-[10px] text-gray-400">
                      ({p1Count > 0 ? (p1TotalScore / p1Count).toFixed(3) : 0}đ/câu)
                    </span>
                  </div>
                </div>

                {/* PHẦN II CUSTOM */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-gray-200 items-center">
                  <span className="font-bold text-gray-700">Phần II (Đúng / Sai)</span>
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-500 text-[11px]">Số câu:</span>
                    <input
                      type="number"
                      min={0}
                      max={MAX_QUESTION_LIMITS.P2_MAX}
                      value={p2Count}
                      onChange={(e) => setP2Count(Math.min(MAX_QUESTION_LIMITS.P2_MAX, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                      className="w-16 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold font-mono"
                    />
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-500 text-[11px]">Tổng điểm:</span>
                    <input
                      type="number"
                      step={0.25}
                      min={0}
                      value={p2TotalScore}
                      onChange={(e) => setP2TotalScore(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-16 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold font-mono text-primary"
                    />
                    <span className="text-[10px] text-gray-400">
                      ({p2Count > 0 ? (p2TotalScore / p2Count).toFixed(2) : 0}đ/câu)
                    </span>
                  </div>
                </div>

                {/* PHẦN III CUSTOM */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-gray-200 items-center">
                  <span className="font-bold text-gray-700">Phần III (Trả lời ngắn)</span>
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-500 text-[11px]">Số câu:</span>
                    <input
                      type="number"
                      min={0}
                      max={MAX_QUESTION_LIMITS.P3_MAX}
                      value={p3Count}
                      onChange={(e) => setP3Count(Math.min(MAX_QUESTION_LIMITS.P3_MAX, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                      className="w-16 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold font-mono"
                    />
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-500 text-[11px]">Tổng điểm:</span>
                    <input
                      type="number"
                      step={0.25}
                      min={0}
                      value={p3TotalScore}
                      onChange={(e) => setP3TotalScore(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-16 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold font-mono text-primary"
                    />
                    <span className="text-[10px] text-gray-400">
                      ({p3Count > 0 ? (p3TotalScore / p3Count).toFixed(3) : 0}đ/câu)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* HÀNG 4: PHẠM VI GIAO ĐỀ (PUBLIC VS PRIVATE) */}
          <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-800 flex items-center space-x-1.5">
                <Users className="w-4 h-4 text-primary" />
                <span>Phạm vi giao đề</span>
              </span>
              <div className="inline-flex rounded-xl p-0.5 bg-white border border-gray-200 space-x-1">
                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                    !isPrivate ? 'bg-primary text-white shadow-xs' : 'text-gray-600 hover:text-black'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5 inline mr-1" />
                  <span>Công khai</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrivate(true)}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                    isPrivate ? 'bg-primary text-white shadow-xs' : 'text-gray-600 hover:text-black'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5 inline mr-1" />
                  <span>Riêng tư theo lớp</span>
                </button>
              </div>
            </div>

            {isPrivate && (
              <div className="pt-2 border-t border-gray-200/60 animate-in fade-in">
                <span className="text-[11px] text-gray-500 block mb-1.5 font-semibold">
                  Chọn các lớp học được phép tham gia kỳ thi này:
                </span>
                {availableClassrooms.length === 0 ? (
                  <p className="text-[11px] text-amber-700 italic">
                    Bạn chưa tạo lớp học nào. Hãy tạo lớp học trước tại mục "Quản lý Lớp" trên thanh menu.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {availableClassrooms.map(cls => {
                      const isChecked = selectedClassIds.includes(cls.id);
                      return (
                        <label
                          key={cls.id}
                          className={`p-2 rounded-xl border flex items-center space-x-2 cursor-pointer transition-all ${
                            isChecked ? 'bg-emerald-50 border-primary text-primary-dark font-bold' : 'bg-white border-gray-200 text-gray-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedClassIds([...selectedClassIds, cls.id]);
                              } else {
                                setSelectedClassIds(selectedClassIds.filter(id => id !== cls.id));
                              }
                            }}
                            className="rounded text-primary focus:ring-0"
                          />
                          <span className="text-xs truncate">{cls.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* HÀNG 5: ĐẶT LỊCH MỞ / ĐÓNG ĐỀ */}
          <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer font-bold text-gray-800">
              <input
                type="checkbox"
                checked={hasTimeLimit}
                onChange={(e) => setHasTimeLimit(e.target.checked)}
                className="rounded text-primary focus:ring-0"
              />
              <span>Đặt lịch mở & đóng đề thi (Giới hạn thời hạn nộp)</span>
            </label>

            {hasTimeLimit && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-[11px] text-gray-500 block mb-1">Thời điểm mở đề:</span>
                  <input
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-gray-500 block mb-1">Hạn chót đóng đề:</span>
                  <input
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl"
                  />
                </div>
              </div>
            )}
          </div>

          {/* HÀNG 6: FILE ĐỀ THI PDF */}
          <div>
            <label className="font-bold text-gray-700 block mb-1">File Đề thi PDF *</label>
            <div className="flex space-x-2">
              <input
                type="text"
                required
                placeholder="Dán link file PDF (Google Drive, URL) hoặc tải file..."
                value={pdfUrl}
                onChange={(e) => setPdfUrl(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary"
              />
              <label className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-3.5 py-2 rounded-xl cursor-pointer flex items-center space-x-1.5 flex-shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>{isUploading ? 'Đang tải...' : 'Upload PDF'}</span>
                <input type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" />
              </label>
            </div>
          </div>

          {/* HÀNG 7: DÁN ĐÁP ÁN HÀNG LOẠT */}
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-extrabold text-sm text-gray-900">Thiết lập đáp án chuẩn</span>
              <button
                type="button"
                onClick={() => setBatchMode(!batchMode)}
                className="text-xs bg-emerald-50 text-primary-dark hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-full font-bold flex items-center space-x-1 transition-all"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>{batchMode ? 'Đóng chế độ dán nhanh' : 'Dán đáp án hàng loạt (1-Click)'}</span>
              </button>
            </div>

            {batchMode && (
              <div className="p-3.5 bg-gray-50 border-2 border-dashed border-primary/50 rounded-2xl space-y-2.5 mb-4 animate-in fade-in">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[11px] text-gray-700">Dán chuỗi đáp án từ Word / Excel / Text:</span>
                  <button
                    type="button"
                    onClick={handleFillSampleBatch}
                    className="text-[10px] text-primary hover:underline font-bold"
                  >
                    Dán định dạng mẫu
                  </button>
                </div>
                <textarea
                  rows={4}
                  placeholder={`Ví dụ định dạng dễ nhập:
PHẦN I: 1A 2B 3C 4D 5A 6B 7C 8D 9A 10B 11C 12D
PHẦN II: 1:DDDD 2:DDDD 3:DDDD 4:DDDD
PHẦN III: 1:1,5 2:1.5 3:-1 4:-1 5:-1 6:-1`}
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  className="w-full p-2.5 text-[11px] font-mono bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-primary"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">Tự động nhận diện cả trên cùng 1 dòng và cập nhật xuống các ô bên dưới</span>
                  <button
                    type="button"
                    onClick={handleBatchParse}
                    className="bg-primary hover:bg-primary-dark text-white px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-xs"
                  >
                    Phân tích & Tự động điền
                  </button>
                </div>
                {batchFeedback && (
                  <p className="text-[11px] text-emerald-800 font-semibold bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                    {batchFeedback}
                  </p>
                )}
              </div>
            )}

            {/* BẢNG ĐÁP ÁN TRỰC QUAN */}
            <div className="space-y-4">
              {/* PHẦN I */}
              {p1Count > 0 && (
                <div className="p-3 bg-white border border-gray-200 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-gray-800">
                      PHẦN I: Trắc nghiệm 4 lựa chọn ({p1Count} câu)
                    </span>
                    <span className="text-xs text-gray-500 font-mono">
                      Mỗi câu: {(p1TotalScore / (p1Count || 1)).toFixed(3)}đ (chia đều)
                    </span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                    {Array.from({ length: p1Count }, (_, i) => i + 1).map(q => {
                      const val = answerKeys.part_1[q] || '';
                      return (
                        <div key={q} className={`flex items-center space-x-1 p-1.5 rounded-xl border transition-all ${
                          val ? 'bg-emerald-50/60 border-emerald-300' : 'bg-gray-50 border-gray-100'
                        }`}>
                          <span className="text-[10px] font-bold text-gray-500 w-5">C{q}:</span>
                          <select
                            value={val}
                            onChange={(e) => updateKey('part_1', q, e.target.value)}
                            className={`w-full border rounded-lg text-xs font-bold text-center py-0.5 focus:outline-none ${
                              val ? 'bg-white border-primary text-primary-dark' : 'bg-white border-gray-200 text-gray-500'
                            }`}
                          >
                            <option value="">-</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PHẦN II */}
              {p2Count > 0 && (
                <div className="p-3 bg-white border border-gray-200 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-gray-800">
                      PHẦN II: Trắc nghiệm Đúng / Sai ({p2Count} câu)
                    </span>
                    <span className="text-xs text-gray-500 font-mono">
                      Mỗi câu: {(p2TotalScore / (p2Count || 1)).toFixed(2)}đ (Lũy tiến 10% - 25% - 50% - 100%)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Array.from({ length: p2Count }, (_, i) => i + 1).map(q => (
                      <div key={q} className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 space-y-1">
                        <span className="font-bold text-xs text-gray-700 block">Câu {q}:</span>
                        <div className="grid grid-cols-4 gap-1">
                          {['a', 'b', 'c', 'd'].map(sub => {
                            const val = answerKeys.part_2[q]?.[sub];
                            return (
                              <div key={sub} className="flex items-center justify-between bg-white p-1 rounded-lg border border-gray-200 text-[10px]">
                                <span className="font-bold text-gray-600">{sub}:</span>
                                <div className="space-x-0.5">
                                  <button
                                    type="button"
                                    onClick={() => updateKey('part_2', q, true, sub)}
                                    className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                                      val === true ? 'bg-primary text-white shadow-xs' : 'text-gray-500 hover:bg-gray-100'
                                    }`}
                                  >
                                    Đ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateKey('part_2', q, false, sub)}
                                    className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                                      val === false ? 'bg-rose-500 text-white shadow-xs' : 'text-gray-500 hover:bg-gray-100'
                                    }`}
                                  >
                                    S
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PHẦN III */}
              {p3Count > 0 && (
                <div className="p-3 bg-white border border-gray-200 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-gray-800">
                      PHẦN III: Trả lời ngắn ({p3Count} câu)
                    </span>
                    <span className="text-xs text-gray-500 font-mono">
                      Mỗi câu: {(p3TotalScore / (p3Count || 1)).toFixed(3)}đ (chia đều)
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {Array.from({ length: p3Count }, (_, i) => i + 1).map(q => {
                      const val = answerKeys.part_3[q] || '';
                      return (
                        <div key={q} className={`p-2 rounded-xl border transition-all ${
                          val ? 'bg-emerald-50/60 border-emerald-300' : 'bg-gray-50 border-gray-100'
                        }`}>
                          <span className="text-[10px] font-bold text-gray-500 block">Câu {q}:</span>
                          <input
                            type="text"
                            placeholder="Đáp số"
                            value={val}
                            onChange={(e) => updateKey('part_3', q, e.target.value)}
                            className="w-full mt-1 px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-mono text-center focus:outline-none focus:border-primary"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* NÚT SUBMIT */}
          <div className="flex justify-end space-x-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-100"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold shadow-sm flex items-center space-x-1.5"
            >
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{isEditing ? 'Lưu cập nhật kỳ thi' : 'Tạo kỳ thi ngay'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
