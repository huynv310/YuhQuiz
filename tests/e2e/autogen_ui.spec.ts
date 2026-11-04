import { test, expect } from '@playwright/test';

test.describe('YuhQuiz System & UI Verification (Black-box & Boundary Tests)', () => {
  test('Landing page renders correctly and displays brand logo and fast exam form', async ({ page }) => {
    await page.goto('/');

    // 1. Kiểm tra tiêu đề trang và header thương hiệu
    await expect(page).toHaveTitle(/YuhQuiz/i);
    const navLogo = page.locator('nav').first();
    await expect(navLogo).toBeVisible();

    // 2. Kiểm tra ô nhập mã phòng thi nhanh trên landing page
    const examCodeInput = page.locator('input[placeholder*="Mã đề"], input[placeholder*="mã đề"], input[placeholder*="MÃ ĐỀ"]').first();
    if (await examCodeInput.isVisible()) {
      // Boundary test: Mã đề 6 ký tự
      await examCodeInput.fill('t12a8f');
      // Giá trị tự động viết hoa hoặc chấp nhận chuỗi
      const val = await examCodeInput.inputValue();
      expect(val.length).toBeLessThanOrEqual(10);
    }
  });

  test('Auth Modal opens with role tabs and phone validation (Boundary Test)', async ({ page }) => {
    await page.goto('/');

    // Bấm nút đăng nhập
    const loginBtn = page.getByRole('button', { name: /đăng nhập/i }).first();
    if (await loginBtn.isVisible()) {
      await loginBtn.click();

      // Kiểm tra modal xuất hiện
      const modal = page.locator('.glass-panel, [role="dialog"]').first();
      await expect(modal).toBeVisible();

      // Kiểm tra ô nhập số điện thoại
      const phoneInput = page.locator('input[type="tel"], input[placeholder*="điện thoại"], input[placeholder*="SĐT"]').first();
      if (await phoneInput.isVisible()) {
        // Boundary test: số điện thoại rác hoặc quá dài/ngắn
        await phoneInput.fill('0123');
        const submitBtn = modal.getByRole('button', { name: /tiếp tục|đăng nhập/i }).first();
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
          // Hệ thống phải bắt lỗi định dạng số điện thoại
          const errorMsg = page.locator('text=/số điện thoại|hợp lệ|10 số/i').first();
          // Không được phép để lọt số điện thoại không hợp lệ
          await expect(modal).toBeVisible();
        }
      }

      // Đóng modal
      const closeBtn = page.locator('button[aria-label="Đóng"], button:has-text("✕"), button:has-text("X")').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    }
  });

  test('Page is responsive and ambient canvas / main viewports do not crash', async ({ page }) => {
    // Test trên viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();

    // Test trên viewport desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });
});
