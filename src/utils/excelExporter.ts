/**
 * Trình xuất Bảng điểm sang định dạng Excel (.xls có định dạng và tự động co giãn cột)
 */

export function exportGradebookToExcel(
  examTitle: string,
  submissions: any[],
  className?: string
) {
  if (!submissions || submissions.length === 0) {
    alert('Chưa có dữ liệu bài nộp để xuất bảng điểm.');
    return;
  }

  // Tiêu đề các cột
  const headers = [
    'STT',
    'Họ và tên thí sinh',
    'Lớp',
    'Trường học',
    'Điểm Phần I',
    'Điểm Phần II',
    'Điểm Phần III',
    'Tổng Điểm (10.0)',
    'Số lần rời tab',
    'Thời gian ngoài trang (giây)',
    'Trạng thái',
    'Thời gian nộp bài'
  ];

  let rowsHtml = '';

  submissions.forEach((sub, idx) => {
    let p1Score = 0;
    let p2Score = 0;
    let p3Score = 0;

    if (sub.score_details) {
      Object.values(sub.score_details.part_1 || {}).forEach((item: any) => {
        if (item?.is_correct) p1Score += (item.score || 0);
      });
      Object.values(sub.score_details.part_2 || {}).forEach((item: any) => {
        p2Score += (item.score || 0);
      });
      Object.values(sub.score_details.part_3 || {}).forEach((item: any) => {
        if (item?.is_correct) p3Score += (item.score || 0);
      });
    }

    const formatSubmittedTime = sub.submitted_at 
      ? new Date(sub.submitted_at).toLocaleString('vi-VN') 
      : 'Chưa nộp';

    rowsHtml += `
      <tr>
        <td style="text-align: center; border: 1px solid #ddd; padding: 6px;">${idx + 1}</td>
        <td style="border: 1px solid #ddd; padding: 6px; font-weight: bold; mso-number-format:'\@';">${sub.student_name || ''}</td>
        <td style="text-align: center; border: 1px solid #ddd; padding: 6px; mso-number-format:'\@';">${sub.class_name || ''}</td>
        <td style="border: 1px solid #ddd; padding: 6px; mso-number-format:'\@';">${sub.school || 'THPT'}</td>
        <td style="text-align: right; border: 1px solid #ddd; padding: 6px;">${p1Score.toFixed(2)}</td>
        <td style="text-align: right; border: 1px solid #ddd; padding: 6px;">${p2Score.toFixed(2)}</td>
        <td style="text-align: right; border: 1px solid #ddd; padding: 6px;">${p3Score.toFixed(2)}</td>
        <td style="text-align: right; border: 1px solid #ddd; padding: 6px; font-weight: bold; color: #15803d; font-size: 11pt;">${sub.score !== null ? sub.score : '--'}</td>
        <td style="text-align: center; border: 1px solid #ddd; padding: 6px; color: ${sub.cheat_count > 0 ? '#b91c1c' : '#374151'};">${sub.cheat_count || 0}</td>
        <td style="text-align: center; border: 1px solid #ddd; padding: 6px;">${sub.total_away_seconds || 0}s</td>
        <td style="text-align: center; border: 1px solid #ddd; padding: 6px;">${sub.status === 'submitted' ? 'Đã nộp bài' : 'Đang làm'}</td>
        <td style="text-align: center; border: 1px solid #ddd; padding: 6px; mso-number-format:'\@';">${formatSubmittedTime}</td>
      </tr>
    `;
  });

  // Tạo định dạng bảng tính Excel HTML (Microsoft Excel tương thích 100%, tự căn chỉnh độ rộng cột và phông chữ tiếng Việt chuẩn)
  const excelHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Bảng Điểm</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        th { background-color: #2563EB; color: #ffffff; font-weight: bold; font-size: 11pt; text-align: center; vertical-align: middle; border: 1px solid #cccccc; padding: 8px 12px; }
        td { font-size: 10pt; vertical-align: middle; border: 1px solid #e5e7eb; padding: 6px 10px; }
      </style>
    </head>
    <body>
      <table>
        <tr>
          <td colspan="12" style="font-size: 16pt; font-weight: bold; color: #15803d; text-align: center; padding: 15px; border: none;">
            BẢNG TỔNG HỢP ĐIỂM THI: ${examTitle.toUpperCase()}
          </td>
        </tr>
        <tr>
          <td colspan="12" style="font-size: 11pt; color: #4b5563; text-align: center; padding: 5px; border: none;">
            Phạm vi: ${className && className !== 'all' ? `Lớp ${className}` : 'Toàn bộ các lớp'} | Ngày xuất: ${new Date().toLocaleString('vi-VN')}
          </td>
        </tr>
        <tr><td colspan="12" style="border: none; height: 10px;"></td></tr>
        <tr>
          ${headers.map(h => `<th>${h}</th>`).join('')}
        </tr>
        ${rowsHtml}
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const sanitizedTitle = examTitle.replace(/[^a-zA-Z0-9À-ỹ]/g, '_');
  link.setAttribute('href', url);
  link.setAttribute('download', `BangDiem_${sanitizedTitle}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
