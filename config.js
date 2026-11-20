// Cấu hình trang TS TOOLS – sửa ở đây, không cần đụng code.
// SUPABASE_URL / SUPABASE_ANON_KEY: Supabase › Project Settings › API (anon key là khóa CÔNG KHAI, an toàn để đặt ở web; dữ liệu được bảo vệ bằng RLS).
window.TS_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-KEY",
  BRAND: "TS TOOLS",
  TAGLINE: "Tăng tốc triển khai MEP cho dự án của bạn?",
  BUY_URL: "#pricing",
  ZALO_URL: "",                 // vd https://zalo.me/09xxxxxxxx
  EMAIL: "",                    // vd lienhe@...
  // Bảng giá gói Standard (giá gốc để trống nếu không giảm). ĐIỀN GIÁ THẬT trước khi công bố.
  PRICES: [
    { months: 1, price: null, old: null },
    { months: 3, price: null, old: null },
    { months: 6, price: null, old: null },
    { months: 12, price: null, old: null },
  ],
};
