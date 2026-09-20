import React, { useState } from 'react';
import { ShieldCheck, GraduationCap, Phone, School, Calendar, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CompleteProfileModalProps {
  user: any;
  onSuccess: (profile: any) => void;
}

export const CompleteProfileModal: React.FC<CompleteProfileModalProps> = ({ user, onSuccess }) => {
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [school, setSchool] = useState('');
  const [fullName, setFullName] = useState(user.user_metadata?.full_name || user.user_metadata?.name || '');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const phoneRegex = /^(0[3|5|7|8|9])[0-9]{8}$/;
    if (!phoneRegex.test(phone.trim())) {
      setErrorMsg('Số điện thoại không hợp lệ (Cần đủ 10 số di động VN).');
      return false;
    }

    if (!school.trim()) {
      setErrorMsg('Vui lòng nhập tên trường học.');
      return false;
    }

    if (!dob) {
      setErrorMsg('Vui lòng chọn ngày tháng năm sinh.');
      return false;
    }

    setIsLoading(true);
    try {
      // Chống trùng SĐT
      const { data: phoneTaken } = await supabase.rpc('phone_taken', {
        p_phone: phone.trim(),
        p_exclude: user.id,
      });

      if (phoneTaken) {
        throw new Error('Số điện thoại này đã được đăng ký bởi tài khoản khác!');
      }

      const prefix = role === 'teacher' ? 'GV' : 'HS';
      const userCode = `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      const profilePayload = {
        id: user.id,
        full_name: fullName.trim() || 'Người Dùng',
        email: user.email,
        phone: phone.trim(),
        school: school.trim(),
        dob: dob,
        role: role,
        user_code: userCode,
        avatar_url: user.user_metadata?.avatar_url || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('profiles').upsert(profilePayload);
      if (error) throw error;

      onSuccess(profilePayload);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu thông tin hồ sơ.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 yq-overlay z-50 flex items-center justify-center p-4">
      <div className="glass-panel rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl relative font-sans text-[#121212]">
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white font-extrabold mx-auto shadow-sm mb-3">
            <Check className="w-7 h-7" />
          </div>
          <h3 className="font-extrabold text-lg text-gray-900 leading-tight">
            Hoàn Tất Thông Tin Cá Nhân
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Chào mừng <b>{user.email}</b>. Vui lòng bổ sung thông tin để bắt đầu sử dụng.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="font-bold text-gray-700 block mb-1.5">Vai trò của bạn trong hệ thống *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`py-2.5 px-3 rounded-xl border font-bold flex items-center justify-center space-x-2 transition-all ${
                  role === 'student'
                    ? 'border-primary bg-emerald-50 text-primary-dark ring-1 ring-primary'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Học sinh</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('teacher')}
                className={`py-2.5 px-3 rounded-xl border font-bold flex items-center justify-center space-x-2 transition-all ${
                  role === 'teacher'
                    ? 'border-primary bg-emerald-50 text-primary-dark ring-1 ring-primary'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Giáo viên</span>
              </button>
            </div>
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">Họ và tên *</label>
            <input
              type="text"
              required
              placeholder="VD: Nguyễn Văn A"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary focus:bg-white focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">Số điện thoại *</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="tel"
                required
                placeholder="VD: 0912345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary focus:bg-white focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-bold text-gray-700 block mb-1">Ngày sinh *</label>
              <input
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary focus:bg-white focus:outline-none transition-all text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-gray-700 block mb-1">Trường học *</label>
              <input
                type="text"
                required
                placeholder="VD: THPT Chuyên"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary focus:bg-white focus:outline-none transition-all text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-3 bg-primary hover:bg-primary-dark active:scale-[0.98] text-white py-3 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center space-x-2"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Xác nhận & Bắt đầu</span>}
          </button>
        </form>
      </div>
    </div>
  );
};
