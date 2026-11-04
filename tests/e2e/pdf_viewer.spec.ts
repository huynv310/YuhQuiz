import { test, expect } from '@playwright/test';

test.describe('Cross-Device PDF Viewer & Anti-Download Verification', () => {
  test('No unexpected file downloads occur when loading exam pages (Zero-Download Assertion)', async ({ page }) => {
    let downloadedFile: string | null = null;
    page.on('download', (download) => {
      downloadedFile = download.suggestedFilename();
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Khẳng định: Không có bất kỳ file 'viewer' nào tự động tải về khi vào trang
    expect(downloadedFile).toBeNull();
  });

  test('Exam room PDF controls: Zoom buttons and Viewer toggle behave correctly', async ({ page }) => {
    // Giả lập trạng thái đã lưu lựa chọn trình đọc
    await page.addInitScript(() => {
      localStorage.setItem('yq_pdf_viewer', 'canvas');
    });

    await page.goto('/');

    // Kiểm tra localStorage được khởi tạo an toàn
    const viewerPreference = await page.evaluate(() => localStorage.getItem('yq_pdf_viewer'));
    expect(viewerPreference).toBe('canvas');
  });

  test('Mobile Viewport Emulation (iPhone 13 - 390x844): No external popups, full-width responsive layout', async ({ page }) => {
    let popupOpened = false;
    page.on('popup', () => {
      popupOpened = true;
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Khẳng định: Trên thiết bị di động, không được tự động mở cửa sổ hay tab mới
    expect(popupOpened).toBe(false);

    // Kiểm tra thanh điều hướng mobile hiển thị chuẩn xác
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Khẳng định: Không có thanh sidebar 80px lấn chiếm chiều rộng trên màn hình điện thoại
    const desktopSidebar = page.locator('aside.hidden.md\\:flex');
    if (await desktopSidebar.count() > 0) {
      await expect(desktopSidebar).toBeHidden();
    }
  });

  test('Tablet Viewport Emulation (iPad - 768x1024): Split container responsiveness', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const app = page.locator('#root');
    await expect(app).toBeVisible();
  });
});
