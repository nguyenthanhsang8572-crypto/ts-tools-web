// TS TOOLS – cổng tài khoản (Supabase Auth + hàm "lib"). Không có khóa bí mật nào ở đây.
(() => {
  const C = window.TS_CONFIG;
  const sb = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (v) => v == null ? "—" : Number(v).toLocaleString("vi-VN") + "đ";
  const mb = (b) => b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.round(b / 1024) + " KB";
  const dt = (s) => s ? new Date(s).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
  let session = null, profile = null, catalog = null;

  function toast(msg, err = false) { const t = $("#toast"); t.textContent = msg; t.className = "toast show" + (err ? " err" : ""); clearTimeout(t._h); t._h = setTimeout(() => t.className = "toast", 3500); }
  async function lib(params, asBlob = false) {
    const url = `${C.SUPABASE_URL}/functions/v1/lib?` + new URLSearchParams(params);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}`, apikey: C.SUPABASE_ANON_KEY } });
    if (asBlob) { if (!r.ok) return null; return URL.createObjectURL(await r.blob()); }
    const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); return j;
  }

  // ---------------- đăng nhập ----------------
  const isInviteOrRecovery = /type=(invite|recovery|signup)/.test(location.hash);
  function showAuth(setPass = false) {
    $("#app").classList.add("hidden"); $("#auth").classList.remove("hidden");
    $("#loginForm").classList.toggle("hidden", setPass); $("#setPassForm").classList.toggle("hidden", !setPass); $("#authMsg").textContent = "";
  }
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault(); $("#authMsg").textContent = "";
    const { error } = await sb.auth.signInWithPassword({ email: $("#loginEmail").value.trim(), password: $("#loginPass").value });
    if (error) $("#authMsg").textContent = error.message === "Invalid login credentials" ? "Sai email hoặc mật khẩu." : error.message;
  });
  $("#forgotLink").addEventListener("click", async (e) => {
    e.preventDefault(); const email = $("#loginEmail").value.trim();
    if (!email) { $("#authMsg").textContent = "Nhập email trước rồi bấm Quên mật khẩu."; return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    $("#authMsg").style.color = error ? "" : "var(--ok)"; $("#authMsg").textContent = error ? error.message : "Đã gửi email đặt lại mật khẩu (nếu email có trong hệ thống).";
  });
  $("#setPassForm").addEventListener("submit", async (e) => {
    e.preventDefault(); const a = $("#newPass1").value, b = $("#newPass2").value;
    if (a !== b) { $("#authMsg").textContent = "Hai mật khẩu không khớp."; return; }
    const { error } = await sb.auth.updateUser({ password: a });
    if (error) { $("#authMsg").textContent = error.message; return; }
    history.replaceState(null, "", location.pathname + "#profile"); toast("Đã đặt mật khẩu."); start();
  });
  $("#logoutBtn").addEventListener("click", async (e) => { e.preventDefault(); await sb.auth.signOut(); });
  $("#userBox").addEventListener("click", () => $("#userBox").classList.toggle("open"));

  sb.auth.onAuthStateChange((ev, s) => {
    session = s;
    if (!s) { showAuth(false); return; }
    if (ev === "PASSWORD_RECOVERY" || (isInviteOrRecovery && ev === "SIGNED_IN" && !sessionStorage.ts_pw_done)) { sessionStorage.ts_pw_done = 1; showAuth(true); return; }
    if ($("#app").classList.contains("hidden") && $("#setPassForm").classList.contains("hidden")) start();
  });

  async function start() {
    const { data: { session: s } } = await sb.auth.getSession(); session = s; if (!s) return showAuth(false);
    $("#auth").classList.add("hidden"); $("#app").classList.remove("hidden");
    $("#tagline").textContent = C.TAGLINE; $("#buyBtn").href = C.BUY_URL;
    const { data } = await sb.from("profiles").select("*").eq("id", s.user.id).maybeSingle(); profile = data || {};
    $("#userName").textContent = [profile.ho_ten_dem, profile.ten].filter(Boolean).join(" ") || s.user.email;
    route();
  }
  window.addEventListener("hashchange", () => session && route());

  // ---------------- điều hướng ----------------
  const pages = { profile: pageProfile, license: pageLicense, orders: pageOrders, pricing: pagePricing, family: pageFamily, download: pageDownload };
  function route() {
    const p = (location.hash.replace("#", "").split("?")[0]) || "family"; const fn = pages[p] || pageFamily;
    document.querySelectorAll(".side a").forEach((a) => a.classList.toggle("on", a.dataset.page === (pages[p] ? p : "family")));
    $("#userBox").classList.remove("open"); fn($("#main"));
  }

  // ---------------- Profile ----------------
  function pageProfile(m) {
    m.innerHTML = `<div class="card"><h1>Chi tiết tài khoản</h1>
      <div class="tabs"><button class="on" data-t="info">👤 Thông tin tài khoản</button><button data-t="pw">🔑 Đổi mật khẩu</button></div>
      <form id="pf"><div class="form-grid">
        <label>Họ và tên đệm <span class="req">*</span></label><div><input name="ho_ten_dem" required value="${esc(profile.ho_ten_dem)}"></div>
        <label>Tên <span class="req">*</span></label><div><input name="ten" required value="${esc(profile.ten)}"></div>
        <label>Email</label><div><input readonly value="${esc(session.user.email)}"></div>
        <label>Số điện thoại <span class="req">*</span></label><div><input name="phone" required value="${esc(profile.phone)}"></div>
        <label>Địa chỉ</label><div><input name="address" value="${esc(profile.address)}"></div>
        <label>Công ty</label><div><input name="company" value="${esc(profile.company)}"></div>
      </div><p class="center"><button class="btn primary" type="submit">Cập nhật thông tin</button></p></form>
      <form id="pw" class="hidden"><div class="form-grid">
        <label>Mật khẩu mới <span class="req">*</span></label><div><input type="password" name="p1" minlength="8" required autocomplete="new-password"></div>
        <label>Nhập lại <span class="req">*</span></label><div><input type="password" name="p2" minlength="8" required autocomplete="new-password"></div>
      </div><p class="center"><button class="btn primary" type="submit">Đổi mật khẩu</button></p></form></div>`;
    m.querySelectorAll(".tabs button").forEach((b) => b.onclick = () => {
      m.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("on", x === b));
      $("#pf", m).classList.toggle("hidden", b.dataset.t !== "info"); $("#pw", m).classList.toggle("hidden", b.dataset.t !== "pw");
    });
    $("#pf", m).onsubmit = async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
      const { error } = await sb.from("profiles").update(f).eq("id", session.user.id);
      if (error) return toast(error.message, true); Object.assign(profile, f);
      $("#userName").textContent = [profile.ho_ten_dem, profile.ten].filter(Boolean).join(" "); toast("Đã cập nhật thông tin.");
    };
    $("#pw", m).onsubmit = async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); if (f.p1 !== f.p2) return toast("Hai mật khẩu không khớp.", true);
      const { error } = await sb.auth.updateUser({ password: f.p1 }); if (error) return toast(error.message, true); e.target.reset(); toast("Đã đổi mật khẩu.");
    };
  }

  // ---------------- License ----------------
  async function pageLicense(m) {
    m.innerHTML = `<div class="card"><h1>Danh sách license</h1><div id="lt" class="empty">Đang tải…</div></div>`;
    const { data, error } = await sb.from("licenses").select("*").order("created_at", { ascending: false });
    if (error) return $("#lt").textContent = error.message;
    if (!data.length) return $("#lt").innerHTML = `Bạn chưa có license nào. <a href="#pricing">Xem bảng giá</a>`;
    const st = { active: ["HOẠT ĐỘNG", "ok"], locked: ["BỊ KHÓA", "bad"], expired: ["HẾT HẠN", "gray"] };
    $("#lt").outerHTML = `<table><thead><tr><th>STT</th><th>Đơn hàng</th><th>Gói license</th><th>Key</th><th></th><th>Đã sử dụng</th><th>Thời hạn</th><th>Hạn thanh toán</th><th>Ngày hết hạn</th><th>Trạng thái</th></tr></thead><tbody>${
      data.map((l, i) => { const masked = l.license_key.replace(/[^-](?=.{5})/g, "X"); const s = st[l.status] || [l.status, "gray"];
        return `<tr><td>${i + 1}</td><td>${l.order_code ? "#" + esc(l.order_code) : "—"}</td><td><span class="pill blue">${esc(l.package)}</span><div class="muted small">${esc(l.product)}</div></td>
        <td class="key" data-k="${esc(l.license_key)}" data-m="${esc(masked)}">${esc(masked)}</td><td><button class="btn" data-eye>👁</button></td>
        <td>${l.devices_used} / ${l.devices_max} Thiết bị</td><td>${l.months} Tháng</td><td>${dt(l.pay_due)}</td><td>${dt(l.expires_at)}</td><td><span class="pill ${s[1]}">${s[0]}</span></td></tr>`; }).join("")
    }</tbody></table>`;
    m.querySelectorAll("[data-eye]").forEach((b) => b.onclick = () => { const td = b.closest("tr").querySelector(".key"); td.textContent = td.textContent === td.dataset.m ? td.dataset.k : td.dataset.m; });
  }

  // ---------------- Đơn hàng ----------------
  async function pageOrders(m) {
    m.innerHTML = `<div class="card"><h1>Đơn hàng</h1><div id="ot" class="empty">Đang tải…</div></div>`;
    const { data, error } = await sb.from("orders").select("*").order("created_at", { ascending: false });
    if (error) return $("#ot").textContent = error.message;
    if (!data.length) return $("#ot").innerHTML = `Chưa có đơn hàng. <a href="#pricing">Xem bảng giá</a>`;
    const st = { pending: ["CHỜ THANH TOÁN", "warn"], paid: ["ĐÃ THANH TOÁN", "ok"], cancelled: ["ĐÃ HỦY", "gray"] };
    $("#ot").outerHTML = `<table><thead><tr><th>Mã đơn</th><th>Gói</th><th>Thời hạn</th><th>Số tiền</th><th>Ngày tạo</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>${
      data.map((o) => { const s = st[o.status] || [o.status, "gray"]; return `<tr><td><b>#${esc(o.code)}</b></td><td><span class="pill blue">${esc(o.package)}</span></td><td>${o.months} tháng</td><td>${money(o.amount)}</td><td>${dt(o.created_at)}</td><td><span class="pill ${s[1]}">${s[0]}</span></td><td>${esc(o.note)}</td></tr>`; }).join("")
    }</tbody></table>`;
  }

  // ---------------- Bảng giá ----------------
  function pagePricing(m) {
    const ps = C.PRICES.filter((p) => p.price != null); const min = ps.length ? Math.min(...ps.map((p) => p.price / p.months)) : null;
    const contact = (C.ZALO_URL ? `<a class="btn primary wide" target="_blank" rel="noopener" href="${esc(C.ZALO_URL)}">NHẮN ZALO NGAY</a>` : "") + (C.EMAIL ? `<a class="btn ghost wide" style="margin-top:10px" href="mailto:${esc(C.EMAIL)}">✉ GỬI EMAIL</a>` : "");
    m.innerHTML = `<div class="card center"><h1 style="border:0;padding:0;font-size:30px">MUA ADDIN TS TOOLS</h1>
      <p class="lead">Nhiều gói thanh toán linh hoạt theo nhu cầu và thời gian sử dụng – tối ưu chi phí, tối đa hiệu quả.</p>
      <div class="plans" style="text-align:left">
        <div class="plan"><span class="pill blue">STANDARD</span><div class="muted center small" style="margin-top:10px">Chỉ từ</div>
          <div class="price">${min == null ? "Liên hệ" : money(Math.round(min / 1000) * 1000)}</div><div class="per">/ 1 tháng · 1 máy</div>
          <div class="grow">${C.PRICES.map((p) => `<div class="row"><span>${p.months} tháng</span><span>${p.old ? `<s>${money(p.old)}</s>` : ""}<b>${money(p.price)}</b></span></div>`).join("")}</div>
          <a class="btn primary wide" href="${C.ZALO_URL ? esc(C.ZALO_URL) : "#pricing"}" target="_blank" rel="noopener">MUA NGAY</a></div>
        <div class="plan dark"><span class="tag">DOANH NGHIỆP</span><div class="center" style="font-size:30px">🏢</div>
          <span class="pill" style="background:rgba(255,255,255,.12);color:#fff;align-self:center">CÔNG TY</span>
          <div class="price">Liên hệ</div><div class="per" style="color:#cfe3f3">Báo giá riêng theo số máy của công ty</div>
          <ul class="grow"><li>Nhiều chỗ, 1 đơn cho nhiều máy</li><li>Quản lý cấp / khóa key cho từng nhân viên</li><li>Duyệt máy mới, thu hồi key khi đổi người</li><li>Hỗ trợ riêng qua Zalo</li></ul>
          ${contact || `<span class="muted small" style="color:#cfe3f3">(chưa cấu hình Zalo / Email trong config.js)</span>`}</div>
      </div></div>`;
  }

  // ---------------- TS Family ----------------
  let fam = { cat: "", sub: "", q: "", shown: 0 };
  async function pageFamily(m) {
    m.innerHTML = `<div class="card"><h1>TS Family</h1><div id="fz" class="empty">Đang tải danh mục…</div></div>`;
    try { catalog = catalog || await lib({ op: "catalog" }); } catch (e) { $("#fz").textContent = "Không tải được danh mục: " + e.message; return; }
    const tree = catalog.tree; if (!fam.cat) fam.cat = tree[0].name;
    $("#fz").outerHTML = `<div class="filters">
        <label>Danh mục:<select id="fc">${tree.map((t) => `<option ${t.name === fam.cat ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>
        <label>Loại Family:<select id="ft"><option value="">Tất cả</option><option value=".rfa">Family (.rfa)</option><option value=".rvt">Dự án mẫu (.rvt)</option></select></label>
        <label>Tìm kiếm:<input id="fq" placeholder="Tìm kiếm family…" value="${esc(fam.q)}"></label></div>
      <label style="font-weight:700;font-size:14px">Danh mục con:</label><div class="subcats" id="fs"></div>
      <div class="grid" id="fg"></div><div class="more"><button class="btn" id="fm">Xem thêm</button></div>`;
    $("#fc").onchange = () => { fam.cat = $("#fc").value; fam.sub = ""; draw(); };
    $("#ft").onchange = draw; $("#fq").oninput = () => { fam.q = $("#fq").value.trim(); draw(); }; $("#fm").onclick = () => more();
    draw();
  }
  let list = [];
  function draw() {
    const node = catalog.tree.find((t) => t.name === fam.cat); const type = $("#ft").value; const q = fam.q.toLowerCase();
    const inCat = catalog.items.filter((i) => (q ? true : i.cat === fam.cat) && (!type || i.ext === type) && (!q || i.name.toLowerCase().includes(q)));
    const cnt = (s) => inCat.filter((i) => i.cat === fam.cat && i.sub === s).length;
    $("#fs").innerHTML = q ? `<span class="muted">Đang tìm trong tất cả danh mục (${inCat.length} kết quả)</span>` :
      [`<button class="${fam.sub ? "" : "on"}" data-s="">Tất cả <span>(${inCat.length})</span></button>`].concat((node.subs || []).map((s) => `<button class="${fam.sub === s ? "on" : ""}" data-s="${esc(s)}">${esc(s)} <span>(${cnt(s)})</span></button>`)).join("");
    $("#fs").querySelectorAll("button").forEach((b) => b.onclick = () => { fam.sub = b.dataset.s; draw(); });
    list = inCat.filter((i) => q || !fam.sub || i.sub === fam.sub).sort((a, b) => a.name.localeCompare(b.name, "vi"));
    $("#fg").innerHTML = list.length ? "" : `<div class="empty" style="grid-column:1/-1">Danh mục này chưa có family.</div>`;
    fam.shown = 0; more();
  }
  function more() {
    const g = $("#fg"); const next = list.slice(fam.shown, fam.shown + 24); fam.shown += next.length;
    for (const it of next) {
      const d = document.createElement("div"); d.className = "fam";
      d.innerHTML = `<div class="img"><span class="ph">${it.ext === ".rvt" ? "RVT" : "RFA"}</span></div><div class="body"><div class="name" title="${esc(it.name)}">${esc(it.name)}</div>
        <div class="meta">${mb(it.size)}${it.sub ? " · " + esc(it.sub) : ""}</div><button class="btn primary">Tải xuống</button></div>`;
      d.querySelector("button").onclick = (e) => download(it, e.target);
      g.appendChild(d);
      if (it.thumb) lib({ op: "thumb", id: it.id }, true).then((u) => { if (u) d.querySelector(".img").innerHTML = `<img alt="" src="${u}">`; });
    }
    $("#fm").style.display = fam.shown < list.length ? "" : "none";
  }
  async function download(it, btn) {
    btn.disabled = true; const t = btn.textContent; btn.textContent = "Đang chuẩn bị…";
    try { const r = await lib({ op: "family", id: it.id }); const a = document.createElement("a"); a.href = r.url; a.download = r.name; document.body.appendChild(a); a.click(); a.remove(); toast("Đang tải: " + r.name); }
    catch (e) { toast(e.message, true); } finally { btn.disabled = false; btn.textContent = t; }
  }

  // ---------------- Download bộ cài ----------------
  async function pageDownload(m) {
    m.innerHTML = `<div class="card"><h1>Tải xuống Bộ cài</h1><div id="dz" class="empty">Đang tải…</div></div>`;
    const { data, error } = await sb.from("installers").select("*").order("sort", { ascending: false });
    if (error) return $("#dz").textContent = error.message;
    if (!data.length) return $("#dz").textContent = "Chưa có bộ cài nào.";
    $("#dz").outerHTML = `<div class="dl">${data.map((x) => `<div class="r"><b>${esc(x.name)}</b><span class="muted">${esc(x.note)}</span><button class="btn primary" data-id="${x.id}">Tải xuống ⬇</button></div>`).join("")}</div>`;
    m.querySelectorAll("[data-id]").forEach((b) => b.onclick = async () => {
      b.disabled = true; try { const r = await lib({ op: "installer", id: b.dataset.id }); location.href = r.url; toast("Đang tải: " + r.name); } catch (e) { toast(e.message, true); } finally { b.disabled = false; }
    });
  }

  start();
})();
