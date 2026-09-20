import React, { useState } from 'react';
import { X, Users, ArrowRight, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface JoinClassModalProps {
  currentUser: any;
  onClose: () => void;
  onSuccess: (classroom: any) => void;
  initialCode?: string;
}

export const JoinClassModal: React.FC<JoinClassModalProps> = ({
  currentUser,
  onClose,
  onSuccess,
  initialCode = ''
}) => {
  const [code, setCode] = useState(initialCode);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [joinedClass, setJoinedClass] = useState<any | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Tìm lớp học theo mã lớp (Không join profiles để tránh lỗi schema cache)
      const { data: cls, error: clsError } = await supabase.rpc('find_class_by_code', { p_code: cleanCode });

      if (clsError) throw clsError;
      if (!cls) {
        throw new Error('Mã lớp học không tồn tại! Vui lòng kiểm tra lại mã với thầy/cô.');
      }

      // Lấy tên giáo viên nếu có
      const teacherName = cls.teacher_name || 'Thầy/Cô';

      // 2. Thêm học sinh vào lớp học
      const studentName = currentUser?.full_name || currentUser?.user_metadata?.full_name || 'Học sinh';
      const studentPhone = currentUser?.phone || currentUser?.user_metadata?.phone || '';

      const { error: memError } = await supabase
        .from('class_memberships')
        .upsert({
          class_id: cls.id,
          student_id: currentUser.id,
          student_name: studentName,
          student_phone: studentPhone,
        }, { onConflict: 'class_id,student_id' });

      if (memError) throw memError;

      const fullClassData = { ...cls, teacher_name: teacherName };
      setJoinedClass(fullClassData);
      onSuccess(fullClassData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể tham gia lớp.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 yq-overlay z-50 flex items-center justify-center p-4 font-sans text-[#121212]">
      <div className="glass-panel rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-primary flex items-center justify-center mx-auto shadow-sm mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-lg text-gray-900 leading-tight">
            Tham Gia Lớp Học Mới
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Nhập mã 6 ký tự do thầy/cô cung cấp để nhận đề thi
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {joinedClass ? (
          <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
            <h4 className="font-bold text-sm text-primary-dark">Bạn đã vào lớp thành công!</h4>
            <div className="bg-white p-3 rounded-xl border border-emerald-100 text-xs text-left space-y-1">
              <p>Lớp: <b className="text-gray-900">{joinedClass.name}</b></p>
              <p>Môn học: <b className="text-gray-900">{joinedClass.subject}</b></p>
              <p>Giáo viên: <b className="text-gray-900">{joinedClass.teacher_name}</b></p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-primary text-white py-2.5 rounded-xl font-bold text-xs shadow-sm hover:bg-primary-dark transition-all"
            >
              Xem đề thi của lớp
            </button>
          </div>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-gray-700 block mb-1 text-center">
                Mã lớp tham gia (6 ký tự) *
              </label>
              <input
                type="text"
                required
                maxLength={8}
                placeholder="VD: 54FPWH"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full text-center tracking-widest font-mono text-xl uppercase font-extrabold px-4 py-3 bg-[#FAFAFA] border-2 border-gray-200 rounded-2xl focus:border-primary focus:bg-white focus:outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !code.trim()}
              className="w-full bg-primary hover:bg-primary-dark active:scale-[0.98] text-white py-3.5 rounded-xl font-bold text-sm shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Vào lớp ngay</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
