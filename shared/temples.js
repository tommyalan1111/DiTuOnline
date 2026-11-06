/**
 * 10 ngôi chùa — dữ liệu dùng chung cho server và client.
 * Mỗi chùa tối đa TEMPLE_CAPACITY người và có một kênh chat riêng.
 */
export const TEMPLE_CAPACITY = 50;

export const TEMPLES = [
  {
    id: 1,
    slug: 'van-son',
    name: 'Chùa Vân Sơn',
    tagline: 'Sương sớm trên núi',
    description: 'Mây phủ lưng chừng núi, chuông chùa vọng giữa tầng không.',
    theme: 'mist',
    seal: '雲',
    accent: '#7d9c8b',
    accentSoft: '#dbe8e1',
  },
  {
    id: 2,
    slug: 'linh-an',
    name: 'Chùa Linh Ẩn',
    tagline: 'Rừng thông tĩnh lặng',
    description: 'Thông reo khe khẽ, một lối đá dẫn vào chốn tịch nhiên.',
    theme: 'pine',
    seal: '隱',
    accent: '#4f7059',
    accentSoft: '#dce9df',
  },
  {
    id: 3,
    slug: 'an-lac',
    name: 'Chùa An Lạc',
    tagline: 'Nắng thu rơi lá',
    description: 'Lá vàng rơi trên sân gạch, nắng trải mật ong khắp mái ngói.',
    theme: 'autumn',
    seal: '樂',
    accent: '#b9772c',
    accentSoft: '#f6e6cf',
  },
  {
    id: 4,
    slug: 'tu-bi',
    name: 'Chùa Từ Bi',
    tagline: 'Hoa sen nở sớm',
    description: 'Hồ sen trước sân, hương thơm theo gió thoảng qua từng bậc đá.',
    theme: 'lotus',
    seal: '慈',
    accent: '#c97f92',
    accentSoft: '#f8e3e7',
  },
  {
    id: 5,
    slug: 'truc-lam',
    name: 'Chùa Trúc Lâm',
    tagline: 'Bóng trúc lay nhẹ',
    description: 'Rặng trúc xanh rì, tiếng lá xào xạc như lời kinh thầm thì.',
    theme: 'bamboo',
    seal: '竹',
    accent: '#6b8c46',
    accentSoft: '#e6efd9',
  },
  {
    id: 6,
    slug: 'bao-thap',
    name: 'Chùa Bảo Tháp',
    tagline: 'Hoàng hôn trên tháp',
    description: 'Nắng chiều nhuộm vàng ngọn tháp cổ, chuông ngân dài trong gió.',
    theme: 'dusk',
    seal: '塔',
    accent: '#c08243',
    accentSoft: '#f7e3cd',
  },
  {
    id: 7,
    slug: 'tinh-tam',
    name: 'Chùa Tịnh Tâm',
    tagline: 'Đêm trăng thanh',
    description: 'Đèn lồng sáng dọc lối đi, trăng treo trên mái chùa như một lời nguyện.',
    theme: 'night',
    seal: '淨',
    accent: '#5d7ea8',
    accentSoft: '#dbe4f0',
  },
  {
    id: 8,
    slug: 'huong-tich',
    name: 'Chùa Hương Tích',
    tagline: 'Tuyết phủ mái chùa',
    description: 'Tuyết rơi lặng lẽ, phủ trắng con đường đá và những bậc thềm.',
    theme: 'snow',
    seal: '香',
    accent: '#8ba5b6',
    accentSoft: '#eef4f8',
  },
  {
    id: 9,
    slug: 'kim-son',
    name: 'Chùa Kim Sơn',
    tagline: 'Nắng chiều vàng',
    description: 'Ánh hoàng kim đọng trên vách gỗ, khói hương bay chậm như thời gian.',
    theme: 'golden',
    seal: '金',
    accent: '#b9963f',
    accentSoft: '#f7eccd',
  },
  {
    id: 10,
    slug: 'mai-son',
    name: 'Chùa Mai Sơn',
    tagline: 'Mưa xuân lất phất',
    description: 'Mưa bụi giăng ngang sân chùa, từng giọt long lanh trên phiến đá.',
    theme: 'rain',
    seal: '梅',
    accent: '#6f8f96',
    accentSoft: '#dfeaec',
  },
];

export const TEMPLE_MAP = new Map(TEMPLES.map((t) => [t.id, t]));

export function templeById(id) {
  return TEMPLE_MAP.get(Number(id)) || null;
}

/** Tên hiển thị của 10 chùa, dùng cho log/test. */
export const TEMPLE_NAMES = TEMPLES.map((t) => t.name);
