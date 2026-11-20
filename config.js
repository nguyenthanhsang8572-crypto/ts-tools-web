// Cấu hình trang TS TOOLS – sửa ở đây, không cần đụng code.
// SUPABASE_URL / SUPABASE_ANON_KEY: Supabase › Project Settings › API (anon key là khóa CÔNG KHAI, an toàn để đặt ở web; dữ liệu được bảo vệ bằng RLS).
window.TS_CONFIG = {
  SUPABASE_URL: "https://qeplicezhojsvwrrwzay.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlcGxpY2V6aG9qc3Z3cnJ3emF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxMjMwMTEsImV4cCI6MjExMDY5OTAxMX0.OMmnrRdC3PvYMo1T9_AcZh2Pd6fP-wJ6RP2z4c0APuU",
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
