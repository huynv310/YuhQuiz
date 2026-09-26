import React, { useState, useEffect } from 'react';
import { 
  X, Plus, Users, QrCode, Copy, Check, Trash2, 
  School, BookOpen, AlertCircle, RefreshCw, ExternalLink, 
  Award, AlertTriangle, ShieldAlert, CheckCircle2 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { QrImage } from './QrImage';

interface ClassroomModalProps {
  currentUser: any;
  onClose: () => void;
}

export const ClassroomModal: React.FC<ClassroomModalProps> = ({ currentUser, onClose }) => {
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [studentsWithStats, setStudentsWithStats] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisbanding, setIsDisbanding] = useState(false);
  
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('Toán');
  const [school, setSchool] = useState(currentUser?.user_metadata?.school || 'THPT');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [qrModalClass, setQrModalClass] = useState<any | null>(null);

  // Thống kê toàn lớp
  const [classOverallAvg, setClassOverallAvg] = useState<string>('--');
  const [classTotalSubs, setClassTotalSubs] = useState<number>(0);

  const loadClassrooms = async () => {
    if (!currentUser?.id) return;
    setIsLoading(true);

    try {
      // 1. Tải danh sách lớp học của giáo viên
      const { data: classList, error } = await supabase
        .from('classrooms')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (classList && classList.length > 0) {
        // 2. Đếm chính xác sĩ số của từng lớp một cách đồng bộ
        const classIds = classList.map(c => c.id);
        const { data: memCounts } = await supabase
          .from('class_memberships')
          .select('class_id')
          .in('class_id', classIds);

        const countsMap = new Map<string, number>();
        (memCounts || []).forEach((m: any) => {
          countsMap.set(m.class_id, (countsMap.get(m.class_id) || 0) + 1);
        });

        const syncedClasses = classList.map(cls => ({
          ...cls,
          memberCount: countsMap.get(cls.id) || 0,
        }));

        setClassrooms(syncedClasses);
        
        if (!selectedClass) {
          setSelectedClass(syncedClasses[0]);
        } else {
          const currentStillExists = syncedClasses.find(c => c.id === selectedClass.id);
          setSelectedClass(currentStillExists || syncedClasses[0]);
        }
      } else {
        setClassrooms([]);
        setSelectedClass(null);
      }
    } catch (err) {
      console.warn('Lỗi nạp danh sách lớp học:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadClassrooms();
  }, [currentUser]);

  // TẢI CHI TIẾT THÀNH VIÊN, ĐIỂM TRUNG BÌNH & SỐ ĐỀ ĐÃ LÀM CỦA TỪNG HỌC SINH TRONG LỚP
  useEffect(() => {
    if (!selectedClass) {
      setStudentsWithStats([]);
      setClassOverallAvg('--');
      setClassTotalSubs(0);
      return;
    }

    async function fetchClassMembersAndAnalytics() {
      try {
        // 1. Lấy toàn bộ thành viên trong lớp (Truy vấn phẳng, không join schema cache)
        const { data: memberships, error: memError } = await supabase
          .from('class_memberships')
          .select('*')
          .eq('class_id', selectedClass.id)
          .order('joined_at', { ascending: false });

        if (memError) throw memError;

        const members = memberships || [];

        // 2. Lấy profile chi tiết của các học sinh nếu có
        const studentIds = members.map(m => m.student_id).filter(Boolean);
        const profileMap = new Map<string, any>();

        if (studentIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, phone, email, school')
            .in('id', studentIds);

          (profiles || []).forEach((p: any) => profileMap.set(p.id, p));
        }

        // 3. Lấy tất cả bài nộp của các đề thi thuộc lớp này hoặc có class_name khớp
        const { data: submissions } = await supabase
          .from('submissions')
          .select('student_id, student_name, score, status, exam_id')
          .eq('status', 'submitted');

        const classSubmissions = (submissions || []).filter((sub: any) => {
          // Lọc các bài nộp mà học sinh thuộc lớp này hoặc làm trong lớp này
          const isMember = studentIds.includes(sub.student_id);
          const isClassNameMatch = sub.student_name && members.some(m => m.student_name === sub.student_name);
          return isMember || isClassNameMatch;
        });

        setClassTotalSubs(classSubmissions.length);

        // 4. Tính toán cho từng học sinh: Số đề đã nộp & Điểm trung bình riêng của lớp này
        let totalClassScoreSum = 0;
        let totalGradedCount = 0;

        const enrichedStudents = members.map(mem => {
          const prof = profileMap.get(mem.student_id) || {};
          const displayName = prof.full_name || mem.student_name || 'Học sinh';
          const displayPhone = prof.phone || mem.student_phone || '--';
          const displayEmail = prof.email || '--';

          // Lọc các bài nộp của riêng học sinh này
          const mySubs = classSubmissions.filter((sub: any) => {
            return (
              (mem.student_id && sub.student_id === mem.student_id) ||
              (sub.student_name && sub.student_name.toLowerCase() === displayName.toLowerCase())
            );
          });

          const completedCount = mySubs.length;
          const validScores = mySubs.map((s: any) => s.score).filter((sc: any) => sc !== null && sc !== undefined);

          let avgScoreStr = '--';
          if (validScores.length > 0) {
            const sum = validScores.reduce((a: number, b: number) => a + b, 0);
            avgScoreStr = (sum / validScores.length).toFixed(1);
            totalClassScoreSum += sum;
            totalGradedCount += validScores.length;
          }

          return {
            ...mem,
            displayName,
            displayPhone,
            displayEmail,
            completedCount,
            avgScore: avgScoreStr,
          };
        });

        setStudentsWithStats(enrichedStudents);

        if (totalGradedCount > 0) {
          setClassOverallAvg((totalClassScoreSum / totalGradedCount).toFixed(1));
        } else {
          setClassOverallAvg('--');
        }
      } catch (err) {
        console.warn('Lỗi phân tích thành viên lớp học:', err);
      }
    }

    fetchClassMembersAndAnalytics();
  }, [selectedClass]);

  const generateClassCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const classCode = generateClassCode();
      const { data, error } = await supabase
        .from('classrooms')
        .insert({
          teacher_id: currentUser.id,
          name: name.trim(),
          subject: subject.trim(),
          school: school.trim(),
          class_code: classCode,
        })
        .select()
        .single();

      if (error) throw error;
      setName('');
      setIsCreating(false);
      await loadClassrooms();
      setSelectedClass(data);
      alert(`Đã tạo lớp thành công! Mã vào lớp: ${classCode}`);
    } catch (err: any) {
      alert('Không thể tạo lớp: ' + err.message);
    }
  };

  // TÍNH NĂNG MỚI: GIẢI TÁN LỚP HỌC (XÓA VĨNH VIỄN LỚP, KICK TOÀN BỘ THÀNH VIÊN & HỦY GIAO ĐỀ)
  const handleDisbandClass = async (classId: string, className: string) => {
    const confirmInput = prompt(
      `⚠️ CẢNH BÁO QUAN TRỌNG:\n\nBạn đang chuẩn bị GIẢI TÁN lớp "${className}".\n` +
      `- Toàn bộ ${studentsWithStats.length} học sinh sẽ bị KICK ra khỏi lớp ngay lập tức.\n` +
      `- Tất cả bài tập và đề thi được giao cho lớp này sẽ bị gỡ bỏ khỏi hệ thống.\n` +
      `- Dữ liệu lớp học sẽ bị XÓA VĨNH VIỄN không thể khôi phục.\n\n` +
      `Để xác nhận, vui lòng gõ chính xác chữ "XOA" vào ô bên dưới:`
    );

    if (confirmInput !== 'XOA' && confirmInput !== 'xoa') {
      alert('Đã hủy thao tác giải tán lớp.');
      return;
    }

    setIsDisbanding(true);
    try {
      // 1. Kick toàn bộ học sinh ra khỏi lớp
      await supabase.from('class_memberships').delete().eq('class_id', classId);

      // 2. Gỡ bỏ toàn bộ bài tập giao cho lớp này
      await supabase.from('exam_assignments').delete().eq('class_id', classId);

      // 3. Xóa vĩnh viễn lớp học
      const { error } = await supabase.from('classrooms').delete().eq('id', classId);
      if (error) throw error;

      alert(`Đã giải tán thành công lớp "${className}"! Toàn bộ học sinh và đề thi của lớp đã được gỡ bỏ.`);
      
      setSelectedClass(null);
      await loadClassrooms();
    } catch (err: any) {
      alert('Lỗi khi giải tán lớp: ' + err.message);
    } finally {
      setIsDisbanding(false);
    }
  };

  // TÍNH NĂNG MỚI: KICK RIÊNG 1 HỌC SINH RA KHỎI LỚP (giữ nguyên bài làm/điểm của học sinh đó)
  const [kickingId, setKickingId] = useState<string | null>(null);
  const handleKickStudent = async (membershipId: string, studentId: string, displayName: string) => {
    if (!selectedClass) return;
    if (!confirm(`Kick học sinh "${displayName}" ra khỏi lớp "${selectedClass.name}"?\nCác bài đã nộp của em vẫn được giữ nguyên, nhưng em sẽ không còn nhận đề mới của lớp này.`)) {
      return;
    }
    setKickingId(membershipId);
    try {
      const { error } = await supabase
        .from('class_memberships')
        .delete()
        .eq('class_id', selectedClass.id)
        .eq('student_id', studentId);
      if (error) throw error;

      setStudentsWithStats(prev => prev.filter(st => st.id !== membershipId));
      setClassrooms(prev => prev.map(c => (c.id === selectedClass.id ? { ...c, memberCount: Math.max(0, (c.memberCount || 1) - 1) } : c)));
    } catch (err: any) {
      alert('Không thể kick học sinh: ' + err.message);
    } finally {
      setKickingId(null);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="fixed inset-0 yq-overlay z-50 flex items-center justify-center p-4">
      <div className="glass-panel rounded-3xl max-w-5xl w-full p-6 max-h-[92vh] flex flex-col shadow-2xl relative font-sans text-[#121212]">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-3 pb-4 border-b border-gray-100">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white font-extrabold shadow-sm">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-gray-900 leading-tight">Quản Lý Lớp Học & Thành Viên</h3>
            <p className="text-xs text-gray-400">Xem sĩ số thực tế, điểm trung bình từng em, cấp mã tham gia hoặc giải tán lớp</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-4 flex-1 overflow-hidden">
          
          {/* CỘT TRÁI: DANH SÁCH LỚP CỦA BẠN */}
          <div className="md:col-span-4 flex flex-col space-y-3 overflow-hidden border-r border-gray-100 pr-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-xs text-gray-400 uppercase tracking-wider">Lớp của bạn ({classrooms.length})</span>
              <button
                onClick={() => setIsCreating(!isCreating)}
                className="bg-primary hover:bg-primary-dark text-white px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1 shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm lớp</span>
              </button>
            </div>

            {/* FORM TẠO LỚP NHANH */}
            {isCreating && (
              <form onSubmit={handleCreateClass} className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200 space-y-2.5 text-xs animate-in fade-in duration-200">
                <span className="font-extrabold text-xs text-primary-dark block">Tạo lớp học mới</span>
                <input
                  type="text"
                  required
                  placeholder="Tên lớp (VD: 12A1)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-primary"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Môn (VD: Toán)"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    placeholder="Trường học"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-3 py-1 rounded-lg text-gray-500 font-bold hover:bg-gray-100"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1 rounded-lg bg-primary hover:bg-primary-dark text-white font-bold shadow-sm"
                  >
                    Tạo ngay
                  </button>
                </div>
              </form>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {classrooms.map((cls) => {
                const isSelected = selectedClass?.id === cls.id;
                const memberCount = cls.memberCount || 0;

                return (
                  <div
                    key={cls.id}
                    onClick={() => setSelectedClass(cls)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-white/70 border-primary shadow-md ring-2 ring-primary/50'
                        : 'bg-white/60 border-white/70 hover:border-primary/40'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-extrabold text-sm text-gray-900">{cls.name}</span>
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-bold">
                        {cls.subject}
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center space-x-1 font-semibold text-gray-700">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        <span>Sĩ số: <b className="text-emerald-700 font-bold">{memberCount}</b> HS</span>
                      </span>

                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyCode(cls.class_code);
                          }}
                          className="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 font-mono font-bold px-2 py-0.5 rounded-lg flex items-center space-x-1"
                          title="Sao chép mã lớp"
                        >
                          {copiedCode === cls.class_code ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3 text-gray-400" />}
                          <span>{cls.class_code}</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQrModalClass(cls);
                          }}
                          className="p-1 hover:bg-gray-100 rounded-lg text-gray-600"
                          title="Chiếu mã QR lớp học"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CỘT PHẢI: CHI TIẾT LỚP, BẢNG ĐIỂM TỪNG HỌC SINH & NÚT GIẢI TÁN LỚP */}
          <div className="md:col-span-8 flex flex-col space-y-3 overflow-hidden">
            {selectedClass ? (
              <>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pb-3 border-b border-gray-100 gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-extrabold text-lg text-gray-900">{selectedClass.name}</h4>
                      <span className="text-xs bg-emerald-50 text-primary-dark px-2.5 py-0.5 rounded-full font-bold border border-emerald-200">
                        {selectedClass.subject}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {selectedClass.school || 'Trường THPT'} • Mã lớp: <b className="text-gray-800 font-mono text-xs">{selectedClass.class_code}</b>
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setQrModalClass(selectedClass)}
                      className="flex items-center space-x-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-2xs"
                    >
                      <QrCode className="w-3.5 h-3.5 text-primary" />
                      <span>Mã QR lớp</span>
                    </button>

                    {/* NÚT GIẢI TÁN LỚP (YÊU CẦU: XÓA LỚP, KICK THÀNH VIÊN & HỦY GIAO ĐỀ) */}
                    <button
                      onClick={() => handleDisbandClass(selectedClass.id, selectedClass.name)}
                      disabled={isDisbanding}
                      className="flex items-center space-x-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-2xs"
                      title="Giải tán lớp học này vĩnh viễn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isDisbanding ? 'Đang giải tán...' : 'Giải tán lớp'}</span>
                    </button>
                  </div>
                </div>

                {/* THẺ THỐNG KÊ TỔNG QUAN CỦA LỚP */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-[#FAFAFA] p-2.5 rounded-2xl border border-gray-100 text-center">
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Sĩ số thành viên</span>
                    <span className="text-base font-extrabold text-primary">{studentsWithStats.length} HS</span>
                  </div>
                  <div className="bg-[#FAFAFA] p-2.5 rounded-2xl border border-gray-100 text-center">
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Điểm TB toàn lớp</span>
                    <span className="text-base font-extrabold text-gray-800">{classOverallAvg}</span>
                  </div>
                  <div className="bg-[#FAFAFA] p-2.5 rounded-2xl border border-gray-100 text-center">
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Lượt bài nộp</span>
                    <span className="text-base font-extrabold text-blue-600">{classTotalSubs} bài</span>
                  </div>
                </div>

                {/* BẢNG DANH SÁCH HỌC SINH KÈM ĐIỂM TRUNG BÌNH & SỐ ĐỀ ĐÃ LÀM (YÊU CẦU ĐỀ BÀI) */}
                <div className="flex-1 overflow-y-auto pr-1">
                  {studentsWithStats.length === 0 ? (
                    <div className="h-56 flex flex-col items-center justify-center text-gray-400 space-y-2 text-xs">
                      <Users className="w-8 h-8 text-gray-300" />
                      <p className="font-bold text-gray-600">Chưa có học sinh nào tham gia lớp này.</p>
                      <p className="text-[11px] text-gray-400 max-w-sm text-center">
                        Hãy gửi mã <b className="font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{selectedClass.class_code}</b> hoặc chiếu mã QR để học sinh quét vào lớp.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-400 uppercase font-semibold text-[10px]">
                          <th className="py-2.5 px-2">STT</th>
                          <th className="py-2.5 px-2">Họ và tên thí sinh</th>
                          <th className="py-2.5 px-2">Số điện thoại</th>
                          <th className="py-2.5 px-2 text-center">Số đề đã nộp</th>
                          <th className="py-2.5 px-2 text-right">Điểm TB lớp</th>
                          <th className="py-2.5 px-2 text-right">Ngày vào lớp</th>
                          <th className="py-2.5 px-2 text-center">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {studentsWithStats.map((st, idx) => (
                          <tr key={st.id} className="hover:bg-gray-50 transition-colors">
                            <td className="py-2.5 px-2 text-gray-400 font-mono">{idx + 1}</td>
                            <td className="py-2.5 px-2 font-bold text-gray-900">{st.displayName}</td>
                            <td className="py-2.5 px-2 font-mono text-gray-600">{st.displayPhone}</td>
                            <td className="py-2.5 px-2 text-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700">
                                {st.completedCount} đề
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              <span className="font-extrabold text-xs text-primary bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                {st.avgScore} đ
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-right text-gray-400 text-[11px]">
                              {new Date(st.joined_at).toLocaleDateString('vi-VN')}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <button
                                onClick={() => handleKickStudent(st.id, st.student_id, st.displayName)}
                                disabled={kickingId === st.id}
                                title="Kick học sinh này khỏi lớp"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all disabled:opacity-50"
                              >
                                <Trash2 className="w-3 h-3" />
                                {kickingId === st.id ? '...' : 'Kick'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">
                Chọn một lớp bên trái để xem danh sách thành viên và điểm số
              </div>
            )}
          </div>

        </div>

        {/* MODAL PHÓNG TO MÃ QR ĐỂ CHIẾU MÁY CHIẾU TẠI LỚP */}
        {qrModalClass && (
          <div className="fixed inset-0 yq-overlay z-60 flex items-center justify-center p-4">
            <div className="glass-panel rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl relative">
              <button
                onClick={() => setQrModalClass(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold"
              >
                <X className="w-4 h-4" />
              </button>

              <div>
                <h4 className="font-extrabold text-lg text-gray-900">Mã QR Vào Lớp</h4>
                <p className="text-xs text-primary font-bold mt-0.5">{qrModalClass.name} • {qrModalClass.subject}</p>
              </div>

              <QrImage
                text={`https://yuhquiz.id.vn/join/${qrModalClass.class_code}`}
                className="w-56 h-56 mx-auto p-2 glass-panel rounded-2xl border-2 border-gray-100 shadow-md object-contain"
              />

              <div className="bg-[#FAFAFA] p-3 rounded-2xl border border-gray-200">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Mã tham gia thủ công</span>
                <span className="font-mono text-2xl font-extrabold tracking-widest text-gray-900 block mt-0.5">
                  {qrModalClass.class_code}
                </span>
              </div>

              <p className="text-[11px] text-gray-500">
                Học sinh dùng camera điện thoại quét mã QR hoặc nhập mã 6 ký tự trên màn hình trang chủ để vào lớp.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
