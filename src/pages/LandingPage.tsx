import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, BookOpen, LogIn, BarChart3, Users, ChevronRight, ListChecks, ToggleRight, Type } from 'lucide-react';
import { LogoMark } from '../components/Logo';
import { ExamRoomMock, AnalyticsMock, PracticeMock } from './LandingMocks';

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

const FORMATS = [
  { no: 'I', icon: <ListChecks className="w-6 h-6" />, title: 'Trắc nghiệm nhiều lựa chọn', desc: 'Chọn một trong bốn đáp án A, B, C, D.', tone: 'bg-blue-100 text-blue-600' },
  { no: 'II', icon: <ToggleRight className="w-6 h-6" />, title: 'Đúng / Sai', desc: 'Mỗi câu có bốn ý a, b, c, d, điểm tính theo số ý đúng.', tone: 'bg-emerald-100 text-emerald-600' },
  { no: 'III', icon: <Type className="w-6 h-6" />, title: 'Trả lời ngắn', desc: 'Điền đáp án là số, nhận cả dạng 1,5 lẫn 1.5.', tone: 'bg-violet-100 text-violet-600' },
];

const STEPS = [
  { title: 'Phòng thi gọn gàng', desc: 'Đề bên trái, phiếu trả lời bên phải. Bài được lưu liên tục, mất mạng vẫn không mất bài.' },
  { title: 'Chấm và phân tích tự động', desc: 'Giáo viên xem phổ điểm, tỉ lệ đúng từng câu, chấm lại khi sửa đáp án.' },
  { title: 'Luyện tập theo chủ đề', desc: 'Học sinh lọc câu hỏi theo môn, khối, hashtag và xem lời giải ngay.' },
];

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
    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // Hero
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('.lp-badge', { opacity: 0, y: -16, duration: 0.6 })
        .from('.lp-line > span', { yPercent: 110, duration: 0.9, stagger: 0.12 }, '-=0.3')
        .from('.lp-desc', { opacity: 0, y: 20, duration: 0.7 }, '-=0.5')
        .from('.lp-ctas > *', { opacity: 0, y: 16, stagger: 0.1, duration: 0.6 }, '-=0.4')
        .from('.lp-hero-3d', { opacity: 0, scale: 0.92, duration: 1.2 }, 0.2);

      // Cuộn: hiện dần các khối
      gsap.utils.toArray<HTMLElement>('.lp-reveal').forEach((el) => {
        gsap.from(el, { opacity: 0, y: 40, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
      });
      gsap.from('.lp-format', {
        opacity: 0, y: 50, stagger: 0.15, duration: 0.8, ease: 'power3.out',
        scrollTrigger: { trigger: '.lp-formats', start: 'top 80%' },
      });
      // Nền hero trôi chậm theo cuộn
      gsap.to('.lp-blob', { yPercent: -25, ease: 'none', scrollTrigger: { trigger: '.lp-hero', start: 'top top', end: 'bottom top', scrub: true } });
    });

    // Trình diễn giao diện: ghim màn hình, cuộn để chuyển cảnh (chỉ trên desktop)
    mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
      const shots = gsap.utils.toArray<HTMLElement>('.lp-shot');
      const steps = gsap.utils.toArray<HTMLElement>('.lp-step');
      gsap.set('.lp-stage', { height: 480 });
      gsap.set(shots, { position: 'absolute', inset: 0, opacity: (i: number) => (i === 0 ? 1 : 0), y: (i: number) => (i === 0 ? 0 : 70), scale: (i: number) => (i === 0 ? 1 : 0.95) });
      gsap.set(steps, { opacity: (i: number) => (i === 0 ? 1 : 0.35) });

      const curve = document.querySelector<SVGPathElement>('.mk-curve');
      if (curve) {
        const len = curve.getTotalLength();
        gsap.set(curve, { strokeDasharray: len, strokeDashoffset: len });
      }
      gsap.set('.mk-bar', { scaleX: 0, transformOrigin: 'left center' });

      gsap.timeline({
        defaults: { ease: 'power2.inOut', duration: 1 },
        scrollTrigger: { trigger: '.lp-show-pin', start: 'top top', end: '+=2600', pin: true, scrub: 0.6, anticipatePin: 1 },
      })
        .to({}, { duration: 0.6 })
        .to(shots[0], { opacity: 0, y: -60, scale: 0.95 }, '>')
        .to(steps[0], { opacity: 0.35 }, '<')
        .to(shots[1], { opacity: 1, y: 0, scale: 1 }, '<0.2')
        .to(steps[1], { opacity: 1 }, '<')
        .to('.mk-curve', { strokeDashoffset: 0, duration: 1.2 }, '<0.3')
        .to('.mk-bar', { scaleX: 1, stagger: 0.12, duration: 0.6 }, '<0.2')
        .to({}, { duration: 0.6 })
        .to(shots[1], { opacity: 0, y: -60, scale: 0.95 }, '>')
        .to(steps[1], { opacity: 0.35 }, '<')
        .to(shots[2], { opacity: 1, y: 0, scale: 1 }, '<0.2')
        .to(steps[2], { opacity: 1 }, '<')
        .to({}, { duration: 0.6 });
    });

    return () => mm.revert();
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="relative min-h-screen bg-slate-50 overflow-x-clip font-sans text-slate-900 selection:bg-blue-200">

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 bg-slate-50/80 backdrop-blur-md border-b border-slate-200/50">
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 max-w-7xl mx-auto w-full">
          <button onClick={() => window.location.reload()} aria-label="YuhQuiz" className="flex items-center space-x-2.5 hover:opacity-80 transition-opacity">
            <LogoMark className="w-10 h-10 drop-shadow-md" />
            <span className="font-heading font-extrabold text-xl tracking-tight text-slate-800">YuhQuiz</span>
          </button>

          <div className="flex items-center space-x-2 sm:space-x-4">
            {currentUser && userProfile ? (
              <button onClick={onEnterDashboard} className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-md transition-all active:scale-95">
                <BarChart3 className="w-4 h-4" />
                <span>{userProfile.role === 'teacher' ? 'Không gian Giáo viên' : 'Cổng Học sinh'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button onClick={onTeacherLogin} className="hidden sm:block font-bold text-sm text-slate-500 hover:text-slate-900 transition-colors px-3 py-2">Dành cho Giáo viên</button>
                <button onClick={onStudentLogin} className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white px-5 sm:px-6 py-2.5 rounded-full font-bold text-sm shadow-md transition-all active:scale-95">
                  <LogIn className="w-4 h-4" />
                  <span>Đăng nhập</span>
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <header className="lp-hero relative overflow-hidden">
        <div className="lp-blob absolute -top-24 -left-24 w-[32rem] h-[32rem] rounded-full bg-blue-300/30 blur-3xl pointer-events-none" />
        <div className="lp-blob absolute top-40 right-0 w-[28rem] h-[28rem] rounded-full bg-emerald-300/30 blur-3xl pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none opacity-[0.35] [background-image:linear-gradient(#cbd5e1_1px,transparent_1px),linear-gradient(90deg,#cbd5e1_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,#000,transparent)]" />

        <div className="lp-hero-3d hidden lg:block absolute inset-y-0 right-0 w-[52%] z-0">
          {show3D && (
            <Suspense fallback={null}>
              <LandingScene />
            </Suspense>
          )}
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-6 pt-16 pb-24 lg:pt-28 lg:pb-32 min-h-[80vh] flex items-center">
          <div className="max-w-2xl">
            <div className="lp-badge inline-flex items-center space-x-2 bg-white/80 text-blue-700 px-4 py-1.5 rounded-full font-bold text-xs sm:text-sm mb-7 border border-blue-100 shadow-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span>Cấu trúc đề thi BGD, chương trình GDPT 2018</span>
            </div>

            <h1 className="font-heading font-extrabold text-5xl sm:text-6xl xl:text-7xl leading-[1.08] tracking-tight mb-6">
              <span className="lp-line block overflow-hidden pb-1"><span className="block">Khảo thí an toàn,</span></span>
              <span className="lp-line block overflow-hidden pb-1"><span className="block">tiện lợi,</span></span>
              <span className="lp-line block overflow-hidden pb-2"><span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500">không chi phí.</span></span>
            </h1>

            <p className="lp-desc text-lg sm:text-xl text-slate-600 max-w-xl mb-10 leading-relaxed">
              Giáo viên tạo đề và giao bài, học sinh làm bài và luyện tập trên cùng một nền tảng.
            </p>

            <div className="lp-ctas flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <button onClick={onTeacherLogin} className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-bold text-base shadow-xl shadow-blue-500/30 transition-colors group">
                <Users className="w-5 h-5" />
                <span>Dành cho Giáo viên</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button onClick={onStudentLogin} className="flex items-center justify-center space-x-2 bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-700 px-8 py-4 rounded-full font-bold text-base shadow-sm transition-colors">
                <BookOpen className="w-5 h-5 text-emerald-500" />
                <span>Khu vực Học sinh</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── CẤU TRÚC ĐỀ THI ── */}
      <section className="max-w-7xl mx-auto px-5 sm:px-6 py-20">
        <div className="lp-reveal text-center mb-12">
          <h2 className="font-heading font-extrabold text-3xl md:text-4xl mb-3">Đúng cấu trúc đề thi của Bộ GD&ĐT</h2>
          <p className="text-slate-500 text-lg">Ba phần thi theo chương trình GDPT 2018.</p>
        </div>
        <div className="lp-formats grid grid-cols-1 md:grid-cols-3 gap-6">
          {FORMATS.map((f) => (
            <div key={f.no} className="lp-format relative bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-shadow overflow-hidden">
              <span className="absolute top-2 right-5 font-heading font-black text-7xl leading-none text-slate-100 select-none">{f.no}</span>
              <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${f.tone}`}>{f.icon}</div>
              <h3 className="relative font-heading font-bold text-xl mb-2">Phần {f.no}: {f.title}</h3>
              <p className="relative text-slate-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TRÌNH DIỄN GIAO DIỆN ── */}
      <section className="lp-show bg-gradient-to-b from-slate-50 via-blue-50/60 to-slate-50">
        <div className="lp-show-pin max-w-7xl mx-auto px-5 sm:px-6 py-20 lg:py-0 lg:h-screen lg:flex lg:items-center">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 w-full items-center">
            <div className="lg:col-span-4">
              <h2 className="font-heading font-extrabold text-3xl md:text-4xl mb-8 leading-tight">Xem YuhQuiz hoạt động</h2>
              <ol className="space-y-6">
                {STEPS.map((st, i) => (
                  <li key={st.title} className="lp-step flex gap-4">
                    <span className="w-9 h-9 shrink-0 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center">{i + 1}</span>
                    <div>
                      <h3 className="font-heading font-bold text-lg">{st.title}</h3>
                      <p className="text-slate-600 text-sm leading-relaxed">{st.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="lp-stage lg:col-span-8 relative space-y-8 lg:space-y-0">
              <div className="lp-shot"><ExamRoomMock /></div>
              <div className="lp-shot"><AnalyticsMock /></div>
              <div className="lp-shot"><PracticeMock /></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative bg-slate-900 py-24 px-5 text-center overflow-hidden">
        <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] rounded-full bg-blue-600/30 blur-3xl pointer-events-none" />
        <div className="relative lp-reveal">
          <LogoMark className="w-16 h-16 mx-auto mb-6" />
          <h2 className="font-heading font-extrabold text-3xl md:text-5xl text-white mb-4">Bắt đầu với YuhQuiz</h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto mb-10">Miễn phí cho giáo viên và học sinh.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={onTeacherLogin} className="bg-white hover:bg-slate-100 text-slate-900 px-10 py-4 rounded-full font-bold text-lg shadow-xl transition-all active:scale-95">Dành cho Giáo viên</button>
            <button onClick={onStudentLogin} className="border-2 border-white/30 hover:bg-white/10 text-white px-10 py-4 rounded-full font-bold text-lg transition-all active:scale-95">Khu vực Học sinh</button>
          </div>
        </div>
      </section>

      <footer className="bg-slate-950 py-6 px-6 text-center text-sm text-slate-500 font-medium">© YuhQuiz</footer>
    </div>
  );
}
