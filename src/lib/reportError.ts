import { supabase } from './supabase';

// Ghi lỗi runtime phía trình duyệt vào bảng client_errors (xem migration
// 20261007_client_error_log.sql) để xem lại trong Supabase Dashboard thay vì
// chỉ biết khi người dùng báo lại. Cố tình nuốt mọi lỗi của chính nó — log lỗi
// không được phép làm hỏng thêm luồng chính của app.
export function reportError(message: string, stack?: string) {
  try {
    void supabase.rpc('log_client_error', {
      p_message: message,
      p_stack: stack ?? null,
      p_url: window.location.href,
    });
  } catch {
    // bỏ qua
  }
}

let installed = false;

// Bắt lỗi ngoài React (event handler, setTimeout, promise không catch...) —
// GlobalErrorBoundary trong main.tsx chỉ bắt được lỗi lúc render.
export function installGlobalErrorReporting() {
  if (installed) return;
  installed = true;

  window.addEventListener('error', (e) => {
    reportError(e.message || 'window error', e.error?.stack);
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    reportError(`Unhandled rejection: ${message}`, reason instanceof Error ? reason.stack : undefined);
  });
}
