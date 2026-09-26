import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AmbientBackground } from './components/AmbientBackground';
import { initGlassPointer, initModalBehavior } from './lib/motion';
initGlassPointer();
initModalBehavior();

// ERROR BOUNDARY TOÀN CỤC CHỐNG MÀN HÌNH TRẮNG 100%
class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Lỗi giao diện bị chặn bởi GlobalErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-6 text-[#121212] font-sans">
          <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-xl max-w-lg w-full text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              ⚠️
            </div>
            <h2 className="text-lg font-extrabold text-gray-900">Giao diện gặp sự cố tạm thời</h2>
            <p className="text-xs text-gray-500">
              Vui lòng làm mới trang để tiếp tục. Nếu vẫn còn lỗi, hãy liên hệ hỗ trợ.
            </p>
            <button
              onClick={() => {
                localStorage.removeItem('active_exam_session');
                window.location.href = '/';
              }}
              className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all"
            >
              Về Trang Chủ An Toàn
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <AmbientBackground />
      <App />
    </GlobalErrorBoundary>
  </React.StrictMode>
);
