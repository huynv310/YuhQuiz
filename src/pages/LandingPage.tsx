import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowRight, BookOpen, Clock, ShieldCheck, LogIn,
  BarChart3, Users, Zap, ChevronRight, PenTool
} from 'lucide-react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

interface LandingPageProps {
  onTeacherLogin: () => void;
  onStudentLogin: () => void;
  onGuestExam?: (examId: string) => void;
  currentUser?: any;
  userProfile?: any;
  onEnterDashboard?: () => void;
}

// Cảnh 3D nạp trễ: chỉ trên máy tính, không bật giảm chuyển động / tiết kiệm dữ liệu
const LandingScene = lazy(() => import('./LandingScene'));

function useShow3D(): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const nav: any = navigator;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const saveData = nav.connection?.saveData;
    const wide = window.innerWidth >= 1024;
    if (reduce || saveData || !wide) return;
    const w: any = window;
    const start = () => setShow(true);
    const id = w.requestIdleCallback ? w.requestIdleCallback(start, { timeout: 2500 }) : setTimeout(start, 1500);
    return () => (w.cancelIdleCallback ? w.cancelIdleCallback(id) : clearTimeout(id));
  }, []);
  return show;
}

// ─── MAIN LANDING PAGE ───
export default function LandingPage({
  onTeacherLogin,
  onStudentLogin,
  currentUser,
  userProfile,
  onEnterDashboard,
}: LandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const show3D = useShow3D();

  useGSAP(() => {
    // 1. Hero Animation (Load in)
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.lp-badge',    { opacity: 0, y: -20, duration: 0.8, ease: 'back.out(1.5)' })
      .from('.lp-title',    { opacity: 0, y: 30,  duration: 0.8 }, '-=0.4')
      .from('.lp-desc',     { opacity: 0, y: 20,  duration: 0.8 }, '-=0.5')
      .from('.lp-ctas',     { opacity: 0, scale: 0.95, duration: 0.6, ease: 'back.out(1.2)' }, '-=0.4')
      .from('.lp-stat',     { opacity: 0, y: 15, stagger: 0.1, duration: 0.6 }, '-=0.3');

    // 2. ScrollTrigger cho các Cards (Trượt lên khi cuộn tới)
    const cards = gsap.utils.toArray('.lp-feature-card');
    cards.forEach((card: any, i) => {
      gsap.from(card, {
        scrollTrigger: {
          trigger: card,
          start: 'top 85%',
          toggleActions: 'play none none reverse',
        },
        opacity: 0,
        y: 40,
        duration: 0.7,
        ease: 'power3.out',
        delay: (i % 3) * 0.15, // Stagger nhẹ theo hàng
      });
    });

    // 3. ScrollTrigger cho tiêu đề Section
    gsap.from('.lp-section-title', {
      scrollTrigger: {
        trigger: '.lp-section-title',
        start: 'top 80%',
      },
      opacity: 0,
      y: 20,
      duration: 0.8,
      ease: 'power2.out'
    });

  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="relative min-h-screen bg-slate-50 overflow-x-hidden font-sans text-slate-900 selection:bg-blue-200">
      
      {/* ── 3D Canvas Background ── */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-60">
        {show3D && (
          <Suspense fallback={null}>
            <LandingScene />
          </Suspense>
        )}
      </div>

      {/* ── Gradient Overlay để làm dịu background, chống rối mắt ── */}
      <div className="fixed inset-0 z-[1] pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_0%,rgba(248,250,252,0.3)_0%,rgba(248,250,252,0.95)_100%)]" />

      {/* ── NỘI DUNG CHÍNH (Z-10) ── */}
      <div className="relative z-10 flex flex-col min-h-screen">
        
        {/* ── NAVBAR ── */}
        <nav className="flex items-center justify-between px-6 py-5 max-w-7xl mx-auto w-full sticky top-0 bg-slate-50/80 backdrop-blur-md border-b border-slate-200/50 z-50 transition-all">
          <div onClick={() => window.location.reload()} className="flex items-center space-x-2.5 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-emerald-500/20 border border-white/20">
              YQ
            </div>
            <span className="font-heading font-extrabold text-xl tracking-tight text-slate-800">
              YuhQuiz <span className="text-blue-600">PRO</span>
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {currentUser && userProfile ? (
              <button
                onClick={onEnterDashboard}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-md transition-all active:scale-95"
              >
                <BarChart3 className="w-4 h-4" />
                <span>{userProfile.role === 'teacher' ? 'Không gian Giáo viên' : 'Cổng Học sinh'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button onClick={onTeacherLogin} className="font-bold text-sm text-slate-500 hover:text-slate-900 transition-colors px-3 py-2">
                  Dành cho Giáo viên
                </button>
                <button onClick={onStudentLogin} className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-full font-bold text-sm shadow-md transition-all active:scale-95">
                  <LogIn className="w-4 h-4" />
                  <span>Đăng nhập</span>
                </button>
              </>
            )}
          </div>
        </nav>

        {/* ── HERO SECTION ── */}
        <main className="flex flex-col items-center justify-center text-center px-5 max-w-5xl mx-auto w-full pt-20 pb-16 min-h-[85vh]">
          <div className="lp-badge inline-flex items-center space-x-2 bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full font-bold text-xs sm:text-sm mb-8 border border-blue-200 shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600" />
            </span>
            <span>Sẵn sàng cho cấu trúc đề thi BGD 2025</span>
          </div>

          <h1 className="lp-title font-heading font-extrabold text-5xl sm:text-6xl lg:text-7xl leading-[1.1] text-slate-900 mb-6 tracking-tight">
            Khảo Thí Tốc Độ Cao. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
              Không Giới Hạn, Không Chi Phí.
            </span>
          </h1>

          <p className="lp-desc text-lg sm:text-xl text-slate-600 max-w-3xl mb-10 leading-relaxed font-medium">
            Bạn đã bao giờ thấy một hệ thống cho phép <strong className="text-slate-900">5.000 học sinh</strong> nộp bài cùng lúc 
            mà không cần đến những máy chủ đắt tiền? Bí mật nằm ở kiến trúc Client-Side thông minh, 
            biến mọi rủi ro giật lag thành con số 0.
          </p>

          <div className="lp-ctas flex flex-col sm:flex-row items-center gap-4 mb-16 w-full sm:w-auto">
            <button onClick={onTeacherLogin} className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-bold text-base shadow-xl shadow-blue-500/30 transition-all group active:scale-95">
              <Users className="w-5 h-5" />
              <span>Dành cho Giáo viên</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button onClick={onStudentLogin} className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-700 px-8 py-4 rounded-full font-bold text-base shadow-sm transition-all active:scale-95">
              <BookOpen className="w-5 h-5 text-indigo-500" />
              <span>Khu vực Học sinh</span>
            </button>
          </div>

          {/* ── STAT ROW ── */}
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 border-y border-slate-200/60 py-6 w-full max-w-4xl bg-white/40 backdrop-blur-sm rounded-3xl">
            {[
              { val: '5.000+', label: 'Học sinh/phiên', icon: <Users className="w-5 h-5" /> },
              { val: '100%', label: 'Miễn phí hạ tầng', icon: <Zap className="w-5 h-5" /> },
              { val: '3 Cấp độ', label: 'Barem BGD 2025', icon: <BookOpen className="w-5 h-5" /> },
              { val: '0ms', label: 'Rủi ro mất bài', icon: <ShieldCheck className="w-5 h-5" /> },
            ].map((s) => (
              <div key={s.label} className="lp-stat flex flex-col items-center space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-blue-600">{s.icon}</span>
                  <strong className="font-heading font-extrabold text-slate-900 text-2xl">{s.val}</strong>
                </div>
                <span className="text-slate-500 text-sm font-medium">{s.label}</span>
              </div>
            ))}
          </div>
        </main>

        {/* ── FEATURE SECTIONS ── */}
        <section className="w-full max-w-7xl mx-auto px-5 py-24">
          <div className="text-center mb-16 lp-section-title">
            <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-slate-900 mb-4">Công Nghệ Vượt Trội Ẩn Giấu Bên Trong</h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">Không chỉ là một trang web làm trắc nghiệm. Chúng tôi thiết kế lại toàn bộ quy trình để giải quyết triệt để những nỗi đau của giáo viên và học sinh.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* FEATURE 1 */}
            <div className="lp-feature-card bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-shadow group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110">
                <Zap className="w-32 h-32 text-orange-500" />
              </div>
              <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mb-6 text-orange-600">
                <Zap className="w-7 h-7" />
              </div>
              <h3 className="font-heading font-bold text-xl mb-3 text-slate-900">Thuật Toán "Tránh Bão" Jitter</h3>
              <p className="text-slate-600 leading-relaxed">
                Tại khoảnh khắc kết thúc bài thi, thay vì nã hàng ngàn request làm sập Database, hệ thống sẽ ngẫu nhiên phân bổ độ trễ từ 0 đến 30 giây cho mỗi học sinh. Kết quả? Máy chủ vẫn mỉm cười.
              </p>
            </div>

            {/* FEATURE 2 */}
            <div className="lp-feature-card bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-shadow group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110">
                <ShieldCheck className="w-32 h-32 text-emerald-500" />
              </div>
              <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-6 text-emerald-600">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="font-heading font-bold text-xl mb-3 text-slate-900">Bất Tử Trước Mất Mạng</h3>
              <p className="text-slate-600 leading-relaxed">
                Vô tình bấm F5? Tắt tab? Rớt Wi-Fi? Không sao cả. Mọi cú click được lưu tức thì vào ổ cứng cục bộ (IndexedDB) với độ trễ 0ms. Bài làm của bạn luôn an toàn 100% kể cả khi offline.
              </p>
            </div>

            {/* FEATURE 3 */}
            <div className="lp-feature-card bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-shadow group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110">
                <BookOpen className="w-32 h-32 text-blue-500" />
              </div>
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 text-blue-600">
                <BookOpen className="w-7 h-7" />
              </div>
              <h3 className="font-heading font-bold text-xl mb-3 text-slate-900">Sổ Tay Câu Sai SM-2</h3>
              <p className="text-slate-600 leading-relaxed">
                Đừng chỉ giải đề rồi để đó. Thuật toán lặp lại ngắt quãng (SuperMemo-2) sẽ theo dõi những câu bạn làm sai và tự động nhắc nhở ôn tập vào ngày thứ 1, 3, 7 và 14. 
              </p>
            </div>

            {/* FEATURE 4 */}
            <div className="lp-feature-card bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-shadow group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110">
                <PenTool className="w-32 h-32 text-purple-500" />
              </div>
              <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-6 text-purple-600">
                <PenTool className="w-7 h-7" />
              </div>
              <h3 className="font-heading font-bold text-xl mb-3 text-slate-900">Ghép Ảnh Đứt Trang</h3>
              <p className="text-slate-600 leading-relaxed">
                Câu hỏi bị chia làm đôi bởi 2 trang PDF? Đừng lo. Công cụ cắt ảnh tích hợp Canvas HTML5 cho phép "khâu" mạch lạc Vùng A và Vùng B thành một bức ảnh duy nhất một cách ma thuật.
              </p>
            </div>

            {/* FEATURE 5 */}
            <div className="lp-feature-card bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-shadow group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110">
                <BarChart3 className="w-32 h-32 text-rose-500" />
              </div>
              <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center mb-6 text-rose-600">
                <BarChart3 className="w-7 h-7" />
              </div>
              <h3 className="font-heading font-bold text-xl mb-3 text-slate-900">Radar & Heatmap Lỗ Hổng</h3>
              <p className="text-slate-600 leading-relaxed">
                Điểm số không nói lên tất cả. Hệ thống vẽ Bản đồ Nhiệt (Heatmap) chỉ đích danh chương nào, chuyên đề nào học sinh đang hổng kiến thức để giáo viên kịp thời can thiệp.
              </p>
            </div>

            {/* FEATURE 6 */}
            <div className="lp-feature-card bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-shadow group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110">
                <Clock className="w-32 h-32 text-indigo-500" />
              </div>
              <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6 text-indigo-600">
                <Clock className="w-7 h-7" />
              </div>
              <h3 className="font-heading font-bold text-xl mb-3 text-slate-900">Chấm Điểm Chuẩn BGD 2025</h3>
              <p className="text-slate-600 leading-relaxed">
                Động cơ chấm điểm đa luồng xử lý trọn vẹn 3 cấu trúc: Trắc nghiệm 1 đáp án, Đúng/Sai lũy tiến (10-25-50-100%), và Điền đáp án ngắn chuẩn hóa toán học.
              </p>
            </div>

          </div>
        </section>

        {/* ── CTA BOTTOM ── */}
        <section className="w-full bg-slate-900 py-20 px-5 text-center mt-auto">
          <h2 className="font-heading font-extrabold text-3xl md:text-5xl text-white mb-6">Trải nghiệm tương lai của Khảo Thí.</h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto mb-10">Bắt đầu quản lý kỳ thi và nâng cao chất lượng học tập của bạn hoàn toàn miễn phí ngay hôm nay.</p>
          <button onClick={onTeacherLogin} className="bg-white hover:bg-slate-100 text-slate-900 px-10 py-4 rounded-full font-bold text-lg shadow-xl transition-all active:scale-95">
            Mở Không Gian Giáo Viên
          </button>
        </section>

        {/* ── FOOTER ── */}
        <footer className="bg-slate-950 border-t border-slate-800 py-6 px-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-500 font-medium">
            <span>© 2025 YuhQuiz — Zero Budget Architecture.</span>
            <span>Được thiết kế tỉ mỉ bởi Google Antigravity.</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
