import React, { useId } from 'react';

/**
 * Icon huy hiệu rank — tham khảo ngôn ngữ thiết kế của rank game (LoL, Deltaforce): hình khối
 * và độ "quý hiếm" của màu tăng dần theo bậc (đá thường → đồng → bạc → vàng → ngọc → huyền
 * thoại), nhưng đổi sang màu chủ đạo của YuhQuiz (xanh #2563EB) và hoạ tiết vòng nguyệt quế/
 * ngôi sao thay cho khiên chiến đấu — hợp bối cảnh học tập hơn game bắn súng.
 *
 * Toàn bộ là SVG vector nền trong suốt (không phải ảnh raster) — không có rủi ro vỡ nét ở bất
 * kỳ kích thước nào, và không tốn thêm request tải ảnh.
 */

const TIER_LEVEL: Record<string, number> = {
  'Tân Binh': 0, 'Hạt Giống': 0,
  'Chăm Chỉ': 1, 'Cộng Tác Viên': 1,
  'Xuất Sắc': 2, 'Đóng Góp Tích Cực': 2,
  'Tinh Anh': 3, 'Ngôi Sao Đóng Góp': 3,
  'Thủ Khoa': 4,
  'Huyền Thoại': 5,
};

const LEVEL_COLORS = [
  { base: '#94A3B8', dark: '#64748B', glyph: '#F1F5F9' }, // 0 Đá — slate
  { base: '#C2703D', dark: '#9A5327', glyph: '#FDE9D9' }, // 1 Đồng
  { base: '#B6C2CE', dark: '#8A99A6', glyph: '#FFFFFF' }, // 2 Bạc
  { base: '#EAB308', dark: '#B45309', glyph: '#FFFBEB' }, // 3 Vàng
  { base: '#2563EB', dark: '#1D4ED8', glyph: '#DBEAFE' }, // 4 Ngọc lam (màu brand)
  { base: '#7C3AED', dark: '#5B21B6', glyph: '#FDE68A' }, // 5 Huyền thoại — tím-vàng
];

export function rankLevel(tier: string | null | undefined): number {
  return TIER_LEVEL[tier || ''] ?? 0;
}

/** Màu chủ đạo của 1 bậc rank — dùng để tô điểm chữ/viền ở bảng xếp hạng. */
export function rankColor(tier: string | null | undefined): string {
  return LEVEL_COLORS[rankLevel(tier)].dark;
}

interface RankIconProps {
  tier: string | null | undefined;
  size?: number;
  className?: string;
  /** Hiệu ứng phát sáng quanh huy hiệu theo màu bậc — mặc định bật để icon nổi bật hơn. */
  glow?: boolean;
}

/** Icon huy hiệu 1 bậc rank, dạng SVG nền trong suốt. */
export const RankIcon: React.FC<RankIconProps> = ({ tier, size = 40, className, glow = true }) => {
  const uid = useId().replace(/[:]/g, '');
  const level = rankLevel(tier);
  const c = LEVEL_COLORS[level];
  const gradId = `rankGrad-${uid}`;
  const glowId = `rankGlow-${uid}`;
  const isLegend = level === 5;
  const glowOpacity = [0, 0.25, 0.3, 0.4, 0.45, 0.55][level];

  return (
    <svg
      width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label={tier || 'Tân Binh'}
      style={glow && level > 0 ? { filter: `drop-shadow(0 0 ${3 + level}px ${c.base}99)` } : undefined}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={c.base} />
          <stop offset="100%" stopColor={c.dark} />
        </linearGradient>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor={c.base} stopOpacity="0" />
          <stop offset="100%" stopColor={c.base} stopOpacity={glowOpacity} />
        </radialGradient>
      </defs>

      {/* Vầng hào quang tròn phía sau — càng cao bậc càng rực rỡ */}
      {level > 0 && <circle cx="50" cy="50" r="49" fill={`url(#${glowId})`} />}

      {/* Bậc cao nhất: hào quang tia sáng phía sau */}
      {isLegend && (
        <g opacity={0.65} stroke={c.base} strokeWidth={3}>
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * Math.PI) / 4;
            const x1 = 50 + Math.cos(a) * 39, y1 = 50 + Math.sin(a) * 39;
            const x2 = 50 + Math.cos(a) * 49, y2 = 50 + Math.sin(a) * 49;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeLinecap="round" />;
          })}
        </g>
      )}

      {/* Vòng ngoài (huy chương) */}
      <circle cx="50" cy="50" r="38" fill={`url(#${gradId})`} stroke={c.dark} strokeWidth="2.5" />
      <circle cx="50" cy="50" r="34.5" fill="none" stroke={c.glyph} strokeOpacity={0.85} strokeWidth="1.5" />
      <circle cx="50" cy="50" r="31" fill="none" stroke={c.glyph} strokeOpacity={0.5} strokeWidth="1.5" />

      {/* Vòng nguyệt quế 2 bên: từ bậc Tinh Anh/Ngôi Sao trở lên */}
      {level >= 3 && (
        <g fill="none" stroke={c.glyph} strokeWidth="2.2" strokeLinecap="round">
          <path d="M18 58 C14 50 15 40 22 33" />
          <path d="M20 44 L15 43 M21 50 L16 50 M23 56 L18 57" />
          <path d="M82 58 C86 50 85 40 78 33" />
          <path d="M80 44 L85 43 M79 50 L84 50 M77 56 L82 57" />
        </g>
      )}

      {/* Khiên/huy hiệu trung tâm (hình học tập: mũ tốt nghiệp cách điệu) */}
      <path
        d="M50 30 L70 40 L50 50 L30 40 Z M38 44 L38 55 C38 60 62 60 62 55 L62 44"
        fill="none" stroke={c.glyph} strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round"
      />
      <circle cx="70" cy="40" r="2.6" fill={c.glyph} />

      {/* Sao: từ bậc Xuất Sắc/Đóng Góp Tích Cực trở lên */}
      {level >= 2 && (
        <path
          d="M50 14 L53 21 L61 21.5 L54.5 26.5 L57 34 L50 29.5 L43 34 L45.5 26.5 L39 21.5 L47 21 Z"
          fill={c.glyph}
        />
      )}

      {/* Ngôi vương nhỏ: chỉ bậc Thủ Khoa/Huyền Thoại */}
      {level >= 4 && (
        <path d="M44 68 L47 62 L50 67 L53 62 L56 68 Z" fill={c.glyph} />
      )}
    </svg>
  );
};

interface RankBadgeProps {
  tier: string | null | undefined;
  size?: number;
  showLabel?: boolean;
  className?: string;
}

/** Icon + tên bậc, dạng chip nhỏ gọn — dùng trong header dashboard/hồ sơ. */
export const RankBadge: React.FC<RankBadgeProps> = ({ tier, size = 28, showLabel = true, className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 ${className}`}>
    <RankIcon tier={tier} size={size} />
    {showLabel && (
      <span className="font-extrabold text-xs sm:text-sm whitespace-nowrap" style={{ color: rankColor(tier) }}>
        {tier || 'Tân Binh'}
      </span>
    )}
  </span>
);
