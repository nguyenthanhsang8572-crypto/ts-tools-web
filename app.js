// TS TOOLS – trang tài khoản & thư viện (Supabase Auth + hàm "lib"). Không có khóa bí mật nào ở đây.
(() => {
  const C = window.TS_CONFIG;
  const sb = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (v) => v == null ? "—" : Number(v).toLocaleString("vi-VN") + "đ";
  const mb = (b) => b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.round(b / 1024) + " KB";
  const dt = (s) => s ? new Date(s).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
  let session = null, profile = null, catalog = null;

  function toast(msg, err = false) { const t = $("#toast"); t.textContent = msg; t.className = "toast show" + (err ? " err" : ""); clearTimeout(t._h); t._h = setTimeout(() => t.className = "toast", 3800); }
  async function lib(params, asBlob = false) {
    const r = await fetch(`${C.SUPABASE_URL}/functions/v1/lib?` + new URLSearchParams(params), { headers: { Authorization: `Bearer ${session.access_token}`, apikey: C.SUPABASE_ANON_KEY } });
    if (asBlob) return r.ok ? URL.createObjectURL(await r.blob()) : null;
    const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); return j;
  }

  // ---------------- đăng nhập ----------------
  const fromEmailLink = /type=(invite|recovery|signup)/.test(location.hash);
  function showAuth(setPass = false) {
    $("#app").classList.add("hidden"); $("#auth").classList.remove("hidden");
    $("#loginForm").classList.toggle("hidden", setPass); $("#setPassForm").classList.toggle("hidden", !setPass); $("#authMsg").textContent = "";
  }
  // hiện / ẩn mật khẩu · ghi nhớ tài khoản (email lưu trên trình duyệt này)
  document.querySelectorAll(".eye").forEach((b) => b.onclick = () => {
    const i = document.getElementById(b.dataset.for); i.type = i.type === "password" ? "text" : "password"; b.classList.toggle("on", i.type === "text");
  });
  try { const rem = localStorage.getItem("ts_remember_email"); if (rem) { $("#loginEmail").value = rem; $("#rememberMe").checked = true; } } catch { }
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault(); $("#authMsg").textContent = "";
    const email = $("#loginEmail").value.trim();
    const { error } = await sb.auth.signInWithPassword({ email, password: $("#loginPass").value });
    if (error) { $("#authMsg").textContent = error.message === "Invalid login credentials" ? "Sai email hoặc mật khẩu." : error.message; return; }
    try { if ($("#rememberMe").checked) localStorage.setItem("ts_remember_email", email); else localStorage.removeItem("ts_remember_email"); } catch { }
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
    history.replaceState(null, "", location.pathname + "#library"); toast("Đã đặt mật khẩu."); start();
  });
  // ---- chuyển Đăng nhập / Đăng ký ----
  $("#authSeg").querySelectorAll("button").forEach((b) => b.onclick = () => {
    $("#authSeg").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    $("#loginForm").classList.toggle("hidden", b.dataset.f !== "login"); $("#signupForm").classList.toggle("hidden", b.dataset.f !== "signup"); $("#authMsg").textContent = "";
  });
  $("#signupForm").addEventListener("submit", async (e) => {
    e.preventDefault(); $("#authMsg").style.color = ""; $("#authMsg").textContent = "";
    const f = Object.fromEntries(new FormData(e.target));
    const { data, error } = await sb.auth.signUp({ email: f.email.trim(), password: f.password,
      options: { data: { ho_ten_dem: f.ho_ten_dem.trim(), ten: f.ten.trim(), phone: f.phone.trim(), company: (f.company || "").trim() } } });
    if (error) { $("#authMsg").textContent = /registered/i.test(error.message) ? "Email này đã có tài khoản – chọn Đăng nhập." : error.message; return; }
    if (!data.session) { $("#authMsg").style.color = "var(--ok)"; $("#authMsg").textContent = "Đã gửi đăng ký – đăng nhập sau khi được phê duyệt."; }
  });
  $("#logoutBtn").addEventListener("click", async (e) => { e.preventDefault(); await sb.auth.signOut(); });
  $("#me").addEventListener("click", (e) => { e.stopPropagation(); $("#me").classList.toggle("open"); });
  document.addEventListener("click", () => $("#me").classList.remove("open"));

  sb.auth.onAuthStateChange((ev, s) => {
    session = s;
    if (!s) { showAuth(false); return; }
    if (ev === "PASSWORD_RECOVERY" || (fromEmailLink && ev === "SIGNED_IN" && !sessionStorage.ts_pw_done)) { sessionStorage.ts_pw_done = 1; showAuth(true); return; }
    if ($("#app").classList.contains("hidden") && $("#setPassForm").classList.contains("hidden")) start();
  });

  async function start() {
    const { data: { session: s } } = await sb.auth.getSession(); session = s; if (!s) return showAuth(false);
    $("#auth").classList.add("hidden"); $("#app").classList.remove("hidden");
    const { data } = await sb.from("profiles").select("*").eq("id", s.user.id).maybeSingle(); profile = data || {};
    showName();
    $("#adminTab").classList.toggle("hidden", !profile.is_admin);
    if (profile.is_admin) lib({ op: "admin_list" }).then((l) => { const n = l.filter((x) => x.status === "pending").length; const b = $("#pendBadge"); b.textContent = n; b.classList.toggle("hidden", !n); }).catch(() => {});
    route();
  }
  function showName() {
    const n = [profile.ho_ten_dem, profile.ten].filter(Boolean).join(" ") || session.user.email;
    $("#userName").textContent = n; $("#avatar").textContent = (profile.ten || n).trim().charAt(0).toUpperCase();
  }
  window.addEventListener("hashchange", () => session && route());

  // ---------------- điều hướng ----------------
  const pages = { library: pageLibrary, video: pageVideo, download: pageDownload, license: pageLicense, orders: pageOrders, account: pageAccount, admin: pageAdmin };
  function route() {
    let p = location.hash.replace("#", "").split("?")[0]; if (!pages[p] || (p === "admin" && !profile.is_admin)) p = "library";
    document.querySelectorAll("#tabs a").forEach((a) => a.classList.toggle("on", a.dataset.page === p));
    $("#me").classList.remove("open"); window.scrollTo(0, 0);
    // chưa được duyệt / bị khóa: không vào Thư viện / Bộ cài
    if (profile.status !== "approved" && (p === "library" || p === "download")) return pagePending($("#main"));
    pages[p]($("#main"));
  }
  function pagePending(m) {
    const locked = profile.status === "locked";
    m.innerHTML = `<section class="hero"><h1>${locked ? "Tài khoản đang bị <em>khóa</em>" : "Đang chờ <em>phê duyệt</em>"}</h1>
      <div style="color:#a9c1d9;max-width:680px">${locked ? "Tài khoản của bạn đã bị quản trị khóa quyền tải family. Liên hệ quản trị TS TOOLS nếu cần mở lại."
        : "Cảm ơn bạn đã đăng ký TS TOOLS. Quản trị sẽ xem và phê duyệt tài khoản – sau khi được duyệt, bạn đăng nhập lại để tải family. Trong lúc chờ, bạn có thể xem Video hướng dẫn và cập nhật thông tin Tài khoản."}</div>
      <div class="stats"><span>Email: <b>${esc(session.user.email)}</b></span><span>Trạng thái: <b>${locked ? "Bị khóa" : "Chờ duyệt"}</b></span></div>
      <a class="btn primary" href="#video">Xem video hướng dẫn</a> <a class="btn" style="margin-left:8px" href="#account">Cập nhật tài khoản</a></section>`;
  }

  // ---------------- Quản trị (chỉ is_admin) ----------------
  let admF = "pending";
  let admTab = "users";
  async function pageAdmin(m) {
    if (admTab === "lic") return pageAdminLicense(m);
    m.innerHTML = `<div class="ptitle"><h2>Quản trị</h2><div class="seg" id="atab"><button class="on">Tài khoản</button><button data-t="lic">License</button></div></div>`;
    $("#atab [data-t]").onclick = () => { admTab = "lic"; pageAdmin(m); };
    m.insertAdjacentHTML("beforeend", `<div class="muted" style="margin:-8px 0 12px">Duyệt / khóa / xóa người dùng</div>`);
    m.insertAdjacentHTML("beforeend", `
      <div class="toolbar"><div class="seg" id="aseg"><button data-f="pending">Chờ duyệt</button><button data-f="approved">Đã duyệt</button><button data-f="locked">Bị khóa</button><button data-f="">Tất cả</button></div>
      <input id="aq" placeholder="Tìm theo tên / email / công ty…" style="max-width:320px"></div><div class="panel" id="at"><div class="empty">Đang tải…</div></div>`);
    let list = [];
    try { list = await lib({ op: "admin_list" }); } catch (e) { $("#at").innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const S = { pending: ["Chờ duyệt", "warn"], approved: ["Đã duyệt", "ok"], locked: ["Bị khóa", "bad"] };
    const draw = () => {
      $("#aseg").querySelectorAll("button").forEach((b) => { const n = b.dataset.f ? list.filter((x) => x.status === b.dataset.f).length : list.length; b.textContent = b.textContent.replace(/ \(\d+\)$/, "") + ` (${n})`; b.classList.toggle("on", b.dataset.f === admF); });
      const q = $("#aq").value.trim().toLowerCase();
      const rows = list.filter((x) => (!admF || x.status === admF) && (!q || [x.ho_ten_dem, x.ten, x.email, x.company, x.phone].join(" ").toLowerCase().includes(q)));
      $("#at").innerHTML = rows.length ? `<table><thead><tr><th>Người dùng</th><th>Liên hệ</th><th>Công ty</th><th>Đăng ký</th><th>Đăng nhập cuối</th><th>Lượt tải</th><th>Trạng thái</th><th></th></tr></thead><tbody>${rows.map((x) => {
        const s = S[x.status] || [x.status, "gray"]; const me = x.id === session.user.id;
        const acts = me ? `<span class="muted small">(bạn${x.is_admin ? " · quản trị" : ""})</span>` : [
          x.status !== "approved" ? `<button class="btn primary" data-a="approved" data-id="${x.id}">✓ Duyệt</button>` : "",
          x.status === "approved" ? `<button class="btn" data-a="locked" data-id="${x.id}">Khóa</button>` : "",
          `<button class="btn" data-a="delete" data-id="${x.id}" style="color:var(--bad)">Xóa</button>`].join(" ");
        return `<tr><td><b>${esc([x.ho_ten_dem, x.ten].filter(Boolean).join(" ") || "—")}</b>${x.is_admin ? ` <span class="pill cy">Quản trị</span>` : ""}</td>
          <td>${esc(x.email)}<div class="muted small">${esc(x.phone)}</div></td><td>${esc(x.company) || "—"}</td><td>${dt(x.created_at)}</td><td>${dt(x.last_sign_in_at)}</td>
          <td>${x.downloads}</td><td><span class="pill ${s[1]}">${s[0]}</span></td><td style="white-space:nowrap">${acts}</td></tr>`; }).join("")}</tbody></table>` : `<div class="empty">Không có tài khoản nào.</div>`;
      $("#at").querySelectorAll("[data-a]").forEach((b) => b.onclick = async () => {
        const x = list.find((y) => y.id === b.dataset.id); const who = x.email;
        if (b.dataset.a === "delete" && !confirm(`Xóa hẳn tài khoản ${who}? (không khôi phục được)`)) return;
        b.disabled = true;
        try {
          if (b.dataset.a === "delete") { await lib({ op: "admin_delete", id: x.id }); list = list.filter((y) => y.id !== x.id); toast("Đã xóa " + who); }
          else { await lib({ op: "admin_status", id: x.id, status: b.dataset.a }); x.status = b.dataset.a; toast((b.dataset.a === "approved" ? "Đã duyệt " : "Đã khóa ") + who); }
          const n = list.filter((y) => y.status === "pending").length; $("#pendBadge").textContent = n; $("#pendBadge").classList.toggle("hidden", !n); draw();
        } catch (e) { toast(e.message, true); b.disabled = false; }
      });
    };
    $("#aseg").querySelectorAll("button").forEach((b) => b.onclick = () => { admF = b.dataset.f; draw(); });
    $("#aq").oninput = draw; draw();
  }

  // ---------------- Thư viện ----------------
  const st = { cat: "", sub: "", q: "", type: "", shown: 0, list: [] };
  async function pageLibrary(m) {
    m.innerHTML = `<section class="hero"><h1>Thư viện family <em>Revit MEP</em></h1><div class="muted" style="color:#a9c1d9">Ảnh 3D dựng từ chính family · tải đúng tên · nạp thẳng vào dự án bằng add-in TS TOOLS</div>
      <div class="stats" id="stats"><span>Đang tải danh mục…</span></div>
      <div class="search"><input id="q" placeholder="Tìm family theo tên…  (vd: van bướm, sprinkler, tủ điện)" value="${esc(st.q)}"></div></section>
      <div class="lib"><aside class="panel cats" id="cats"></aside><section><div class="toolbar"><div class="chips" id="chips"></div>
      <div class="seg" id="seg"><button data-t="">Tất cả</button><button data-t=".rfa">Family</button><button data-t=".rvt">Dự án mẫu</button></div></div>
      <p class="crumb" id="crumb"></p><div class="cards" id="cards"><div class="empty">Đang tải…</div></div><div class="more"><button class="btn" id="more">Xem thêm</button></div></section></div>`;
    try { catalog = catalog || await lib({ op: "catalog" }); } catch (e) { $("#cards").innerHTML = `<div class="empty">Không tải được danh mục: ${esc(e.message)}</div>`; return; }
    const its = catalog.items;
    $("#stats").innerHTML = `<span><b>${its.length.toLocaleString("vi-VN")}</b> family</span><span><b>${catalog.tree.length}</b> danh mục</span><span><b>${its.filter((i) => i.thumb).length.toLocaleString("vi-VN")}</b> ảnh 3D</span><span>Cập nhật <b>${esc(catalog.updated)}</b></span>`;
    $("#q").oninput = () => { st.q = $("#q").value.trim(); draw(); };
    $("#seg").querySelectorAll("button").forEach((b) => b.onclick = () => { st.type = b.dataset.t; draw(); });
    $("#more").onclick = more;
    draw();
  }
  function draw() {
    const its = catalog.items, q = st.q.toLowerCase();
    const pass = (i) => (!st.type || i.ext === st.type) && (!q || i.name.toLowerCase().includes(q));
    // cột danh mục
    $("#cats").innerHTML = `<button class="g all ${st.cat ? "" : "on"}" data-c="">Tất cả danh mục <i>${its.filter(pass).length}</i></button>` +
      catalog.tree.map((t) => `<button class="g ${st.cat === t.name ? "on" : ""}" data-c="${esc(t.name)}">${esc(t.name)} <i>${its.filter((i) => i.cat === t.name && pass(i)).length}</i></button>`).join("");
    $("#cats").querySelectorAll(".g").forEach((b) => b.onclick = () => { st.cat = b.dataset.c; st.sub = ""; draw(); });
    // chip nhóm con
    const node = catalog.tree.find((t) => t.name === st.cat); const inCat = its.filter((i) => (!st.cat || i.cat === st.cat) && pass(i));
    $("#chips").innerHTML = node && node.subs.length ? [`<button class="chip ${st.sub ? "" : "on"}" data-s="">Tất cả<i>${inCat.length}</i></button>`]
      .concat(node.subs.map((s) => `<button class="chip ${st.sub === s ? "on" : ""}" data-s="${esc(s)}">${esc(s)}<i>${inCat.filter((i) => i.sub === s).length}</i></button>`)).join("") : "";
    $("#chips").querySelectorAll(".chip").forEach((b) => b.onclick = () => { st.sub = b.dataset.s; draw(); });
    $("#seg").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.t === st.type));
    st.list = inCat.filter((i) => !st.sub || i.sub === st.sub).sort((a, b) => a.name.localeCompare(b.name, "vi"));
    $("#crumb").innerHTML = `<b>${esc(st.cat || "Tất cả danh mục")}</b>${st.sub ? " › <b>" + esc(st.sub) + "</b>" : ""} · ${st.list.length} kết quả${st.q ? ` cho “${esc(st.q)}”` : ""}`;
    $("#cards").innerHTML = st.list.length ? "" : `<div class="empty" style="grid-column:1/-1">Không có family phù hợp.</div>`;
    st.shown = 0; more();
  }
  function more() {
    const box = $("#cards"); const next = st.list.slice(st.shown, st.shown + 24); st.shown += next.length;
    for (const it of next) {
      const d = document.createElement("div"); d.className = "fc";
      d.innerHTML = `<div class="img"><span class="ph">${it.ext === ".rvt" ? "RVT" : "RFA"}</span><span class="ext">${esc(it.ext.slice(1).toUpperCase())}</span>
        <button class="btn primary dl">⬇ Tải xuống</button></div><div class="meta"><div class="nm" title="${esc(it.name)}">${esc(it.name)}</div>
        <div class="sz">${mb(it.size)}${it.sub ? " · " + esc(it.sub) : " · " + esc(it.cat)}</div></div>`;
      d.querySelector(".dl").onclick = (e) => download(it, e.currentTarget);
      box.appendChild(d);
      if (it.thumb) lib({ op: "thumb", id: it.id, v: it.tv || "" }, true).then((u) => { if (u) d.querySelector(".ph").outerHTML = `<img alt="" src="${u}">`; });
    }
    $("#more").style.display = st.shown < st.list.length ? "" : "none";
  }
  /** Tải family đúng tên: lấy file qua hàm lib (có đăng nhập) → lưu bằng tên family; lỗi → link tải trực tiếp (tên theo mã). */
  async function download(it, btn) {
    btn.disabled = true; btn.classList.add("busy"); const t = btn.textContent; const name = it.name + it.ext;
    const save = (href) => { const a = document.createElement("a"); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
    try {
      btn.textContent = "Đang tải… 0%";
      const r = await fetch(`${C.SUPABASE_URL}/functions/v1/lib?op=file&id=${encodeURIComponent(it.id)}`, { headers: { Authorization: `Bearer ${session.access_token}`, apikey: C.SUPABASE_ANON_KEY } });
      if (!r.ok || !r.body) throw new Error((await r.json().catch(() => ({}))).error || "HTTP " + r.status);
      const total = +r.headers.get("Content-Length") || it.size; const rd = r.body.getReader(); const parts = []; let got = 0;
      for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; btn.textContent = `Đang tải… ${Math.min(99, Math.round(got * 100 / total))}%`; }
      const url = URL.createObjectURL(new Blob(parts, { type: "application/octet-stream" })); save(url); setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast("Đã tải: " + name);
    } catch (e) {
      try { const r = await lib({ op: "family", id: it.id }); save(r.url); toast(`Tải trực tiếp (tên file theo mã) – đổi tên thành: ${name}`); }
      catch (e2) { toast(e2.message || e.message, true); }
    } finally { btn.disabled = false; btn.classList.remove("busy"); btn.textContent = t; }
  }

  // ---------------- Video (TikTok) ----------------
  function pageVideo(m) {
    const u = C.TIKTOK_USER; const pins = (C.VIDEOS || []).map((url) => (url.match(/video\/(\d+)/) || [])[1]).filter(Boolean);
    m.innerHTML = `<div class="vid-head"><div class="ptitle" style="margin:0"><h2>Video hướng dẫn</h2><span>TikTok · ${esc(C.TIKTOK_NAME)}</span></div>
      <a class="btn primary" style="margin-left:auto" href="https://www.tiktok.com/@${esc(u)}" target="_blank" rel="noopener">Mở kênh TikTok ↗</a></div>
      <div class="vid-wrap"><div class="panel"><blockquote class="tiktok-embed" cite="https://www.tiktok.com/@${esc(u)}" data-unique-id="${esc(u)}" data-embed-type="creator" style="max-width:780px;min-width:288px;margin:0">
        <section><a target="_blank" rel="noopener" href="https://www.tiktok.com/@${esc(u)}">@${esc(u)}</a></section></blockquote></div>
        <div class="panel tt-note"><b>Kênh ${esc(C.TIKTOK_NAME)}</b><br>Video mới đăng trên TikTok tự hiện ở khung bên cạnh. Bấm vào video để xem, hoặc mở kênh để theo dõi.</div></div>
      ${pins.length ? `<h3 style="margin:26px 0 0">Video ghim</h3><div class="vids">${pins.map((id) => `<blockquote class="tiktok-embed" cite="https://www.tiktok.com/@${esc(u)}/video/${id}" data-video-id="${id}" style="max-width:340px;min-width:280px;margin:0"><section></section></blockquote>`).join("")}</div>` : ""}`;
    const old = document.getElementById("tt-embed"); if (old) old.remove();
    const s = document.createElement("script"); s.id = "tt-embed"; s.async = true; s.src = "https://www.tiktok.com/embed.js"; document.body.appendChild(s);
  }

  // ---------------- Bộ cài ----------------
  async function pageDownload(m) {
    m.innerHTML = `<div class="ptitle"><h2>Bộ cài TS TOOLS</h2><span>Add-in Revit · Bộ family offline (Quản lý Family)</span></div><div class="inst" id="dz"><div class="panel empty">Đang tải…</div></div>`;
    const { data, error } = await sb.from("installers").select("*").order("sort", { ascending: false });
    if (error) return $("#dz").innerHTML = `<div class="panel empty">${esc(error.message)}</div>`;
    if (!data.length) return $("#dz").innerHTML = `<div class="panel empty">Chưa có bộ cài nào.</div>`;
    $("#dz").innerHTML = data.map((x) => `<div class="r"><span class="ic">⚙</span><div><b>${esc(x.name)}</b><div class="muted small">${esc(x.note)}</div></div><button class="btn primary" data-id="${x.id}">⬇ Tải xuống</button></div>`).join("");
    m.querySelectorAll("[data-id]").forEach((b) => b.onclick = async () => {
      b.disabled = true; try { const r = await lib({ op: "installer", id: b.dataset.id }); location.href = r.url; toast("Đang tải: " + r.name); } catch (e) { toast(e.message, true); } finally { b.disabled = false; }
    });
  }

  // ---------------- License (người dùng) ----------------
  const LS = { active: ["Hoạt động", "ok"], locked: ["Bị khóa", "bad"], expired: ["Hết hạn", "gray"] };
  const licExp = (l) => l.expires_at ? dt(l.expires_at) : "Vĩnh viễn";
  async function pageLicense(m) {
    m.innerHTML = `<div class="ptitle"><h2>License của bạn</h2><span>Dán key vào nút <b>License</b> trên ribbon TS TOOLS trong Revit để kích hoạt</span></div><div id="lt"><div class="panel empty">Đang tải…</div></div>`;
    const { data, error } = await sb.from("licenses").select("*").order("created_at", { ascending: false });
    if (error) return $("#lt").innerHTML = `<div class="panel empty">${esc(error.message)}</div>`;
    if (!data.length) return $("#lt").innerHTML = `<div class="panel empty">Bạn chưa có license nào – liên hệ quản trị TS TOOLS.</div>`;
    const { data: devs } = await sb.from("license_devices").select("*");
    $("#lt").innerHTML = data.map((l) => { const s = LS[l.status] || [l.status, "gray"]; const ds = (devs || []).filter((d) => d.license_id === l.id);
      return `<div class="panel lic"><div class="lic-h"><div><span class="pill cy">${esc(l.package)}</span> <span class="pill ${s[1]}">${s[0]}</span>
        <div class="key big" data-k="${esc(l.license_key)}">${esc(l.license_key)}</div></div><button class="btn" data-copy="${esc(l.license_key)}">⧉ Sao chép key</button></div>
        <div class="lic-g"><div><span class="muted">Hết hạn</span><b>${licExp(l)}</b></div><div><span class="muted">Máy</span><b>${ds.length} / ${l.devices_max}</b></div><div><span class="muted">Sản phẩm</span><b>${esc(l.product)}</b></div></div>
        ${ds.length ? `<table><thead><tr><th>Máy</th><th>Revit</th><th>Kích hoạt</th><th>Lần dùng cuối</th><th></th></tr></thead><tbody>${ds.map((d) => `<tr><td>${esc(d.machine_name || "—")}<div class="muted small mono">${esc(d.machine_hash.slice(0, 12))}…</div></td><td>${esc(d.revit)}</td><td>${dt(d.activated_at)}</td><td>${dt(d.last_seen)}</td><td><button class="btn" data-rm="${d.id}">Gỡ máy</button></td></tr>`).join("")}</tbody></table>` : `<div class="muted small">Chưa kích hoạt máy nào.</div>`}</div>`; }).join("");
    m.querySelectorAll("[data-copy]").forEach((b) => b.onclick = () => { navigator.clipboard.writeText(b.dataset.copy); toast("Đã sao chép key."); });
    m.querySelectorAll("[data-rm]").forEach((b) => b.onclick = async () => { if (!confirm("Gỡ máy này khỏi license? (máy đó sẽ phải kích hoạt lại)")) return; try { await lib({ op: "my_dev_remove", id: b.dataset.rm }); toast("Đã gỡ máy."); pageLicense(m); } catch (e) { toast(e.message, true); } });
  }

  // ---------------- Quản trị License ----------------
  async function pageAdminLicense(m) {
    m.innerHTML = `<div class="ptitle"><h2>Quản trị</h2><div class="seg" id="atab"><button data-t="users">Tài khoản</button><button class="on">License</button></div></div>
      <form class="panel" id="lf"><h3 style="margin:0 0 4px">Cấp license mới</h3><div class="lic-form">
        <label>Người dùng<select name="user" id="lfu" required><option value="">— đang tải —</option></select></label>
        <label>Thời hạn<select name="months"><option value="1">1 tháng</option><option value="3">3 tháng</option><option value="6">6 tháng</option><option value="12" selected>12 tháng</option><option value="24">24 tháng</option><option value="0">Vĩnh viễn</option></select></label>
        <label>Số máy<input name="devices" type="number" min="1" value="1"></label>
        <label>Gói<input name="package" value="STANDARD"></label>
        <label class="full">Ghi chú<input name="note" placeholder="vd: đơn #123, thanh toán CK ngày…"></label></div>
        <button class="btn primary" type="submit" style="margin-top:14px">＋ Tạo key</button> <span id="newKey" class="key big" style="margin-left:12px"></span></form>
      <div class="toolbar" style="margin-top:18px"><input id="lq" placeholder="Tìm theo key / email / tên…" style="max-width:340px"></div><div id="ll"><div class="panel empty">Đang tải…</div></div>`;
    $("#atab [data-t]").onclick = () => { admTab = "users"; pageAdmin(m); };
    let users = [], lics = [];
    try { [users, lics] = await Promise.all([lib({ op: "admin_list" }), lib({ op: "admin_lic_list" })]); } catch (e) { $("#ll").innerHTML = `<div class="panel empty">${esc(e.message)}</div>`; return; }
    $("#lfu").innerHTML = `<option value="">— chọn người dùng —</option>` + users.filter((u) => u.status === "approved").map((u) => `<option value="${u.id}">${esc([u.ho_ten_dem, u.ten].filter(Boolean).join(" ") || u.email)} · ${esc(u.email)}</option>`).join("");
    $("#lf").onsubmit = async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); if (!f.user) return toast("Chọn người dùng.", true);
      try { const l = await lib({ op: "admin_lic_create", ...f }); $("#newKey").textContent = l.license_key; navigator.clipboard?.writeText(l.license_key); toast("Đã tạo key (đã sao chép)."); lics = await lib({ op: "admin_lic_list" }); draw(); }
      catch (er) { toast(er.message, true); }
    };
    const act = async (params, msg) => { try { await lib(params); toast(msg); lics = await lib({ op: "admin_lic_list" }); draw(); } catch (e) { toast(e.message, true); } };
    const draw = () => {
      const q = $("#lq").value.trim().toLowerCase();
      const rows = lics.filter((l) => !q || [l.license_key, l.user?.email, l.user?.ten, l.user?.ho_ten_dem, l.note].join(" ").toLowerCase().includes(q));
      $("#ll").innerHTML = rows.length ? rows.map((l) => { const s = LS[l.status] || [l.status, "gray"]; const exp = l.expires_at && Date.parse(l.expires_at) < Date.now();
        return `<div class="panel lic"><div class="lic-h"><div><span class="pill cy">${esc(l.package)}</span> <span class="pill ${exp ? "gray" : s[1]}">${exp ? "Hết hạn" : s[0]}</span>
          <div class="key big">${esc(l.license_key)}</div><div class="muted small">${esc([l.user?.ho_ten_dem, l.user?.ten].filter(Boolean).join(" "))} · ${esc(l.user?.email || "(đã xóa)")}${l.note ? " · " + esc(l.note) : ""}</div></div>
          <div class="lic-acts"><button class="btn" data-copy="${esc(l.license_key)}">⧉ Key</button>
            ${l.status === "locked" ? `<button class="btn" data-st="active" data-id="${l.id}">Mở khóa</button>` : `<button class="btn" data-st="locked" data-id="${l.id}" style="color:var(--bad)">Khóa</button>`}
            <button class="btn" data-ext="${l.id}">Gia hạn</button><button class="btn" data-dev="${l.id}" data-cur="${l.devices_max}">Số máy</button></div></div>
          <div class="lic-g"><div><span class="muted">Hết hạn</span><b>${licExp(l)}</b></div><div><span class="muted">Máy</span><b>${l.devices.length} / ${l.devices_max}</b></div><div><span class="muted">Tạo</span><b>${dt(l.created_at)}</b></div></div>
          ${l.devices.length ? `<table><tbody>${l.devices.map((d) => `<tr><td>${esc(d.machine_name || "—")} <span class="muted small mono">${esc(d.machine_hash.slice(0, 10))}…</span></td><td>${esc(d.revit)} · v${esc(d.addin_version)}</td><td>Dùng cuối ${dt(d.last_seen)}</td><td><button class="btn" data-rmd="${d.id}">Gỡ máy</button></td></tr>`).join("")}</tbody></table>` : ""}</div>`; }).join("") : `<div class="panel empty">Chưa có license.</div>`;
      $("#ll").querySelectorAll("[data-copy]").forEach((b) => b.onclick = () => { navigator.clipboard.writeText(b.dataset.copy); toast("Đã sao chép key."); });
      $("#ll").querySelectorAll("[data-st]").forEach((b) => b.onclick = () => act({ op: "admin_lic_set", id: b.dataset.id, status: b.dataset.st }, b.dataset.st === "locked" ? "Đã khóa license." : "Đã mở khóa."));
      $("#ll").querySelectorAll("[data-ext]").forEach((b) => b.onclick = () => { const n = prompt("Gia hạn thêm bao nhiêu tháng?", "12"); if (n && +n > 0) act({ op: "admin_lic_set", id: b.dataset.ext, extend: n }, `Đã gia hạn ${n} tháng.`); });
      $("#ll").querySelectorAll("[data-dev]").forEach((b) => b.onclick = () => { const n = prompt("Số máy tối đa:", b.dataset.cur); if (n && +n > 0) act({ op: "admin_lic_set", id: b.dataset.dev, devices: n }, "Đã đổi số máy."); });
      $("#ll").querySelectorAll("[data-rmd]").forEach((b) => b.onclick = () => { if (confirm("Gỡ máy này khỏi license?")) act({ op: "admin_dev_remove", id: b.dataset.rmd }, "Đã gỡ máy."); });
    };
    $("#lq").oninput = draw; draw();
  }
  // ---------------- Đơn hàng ----------------
  async function pageOrders(m) {
    m.innerHTML = `<div class="ptitle"><h2>Đơn hàng</h2></div><div class="panel" id="ot"><div class="empty">Đang tải…</div></div>`;
    const { data, error } = await sb.from("orders").select("*").order("created_at", { ascending: false });
    if (error) return $("#ot").innerHTML = `<div class="empty">${esc(error.message)}</div>`;
    if (!data.length) return $("#ot").innerHTML = `<div class="empty">Chưa có đơn hàng.</div>`;
    const S = { pending: ["Chờ thanh toán", "warn"], paid: ["Đã thanh toán", "ok"], cancelled: ["Đã hủy", "gray"] };
    $("#ot").innerHTML = `<table><thead><tr><th>Mã đơn</th><th>Gói</th><th>Thời hạn</th><th>Số tiền</th><th>Ngày tạo</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>${
      data.map((o) => { const s = S[o.status] || [o.status, "gray"]; return `<tr><td class="mono"><b>#${esc(o.code)}</b></td><td><span class="pill cy">${esc(o.package)}</span></td><td>${o.months} tháng</td><td>${money(o.amount)}</td><td>${dt(o.created_at)}</td><td><span class="pill ${s[1]}">${s[0]}</span></td><td>${esc(o.note)}</td></tr>`; }).join("")}</tbody></table>`;
  }

  // ---------------- Tài khoản ----------------
  function pageAccount(m) {
    m.innerHTML = `<div class="ptitle"><h2>Tài khoản</h2><span>${esc(session.user.email)}</span></div><div class="two">
      <form class="panel" id="pf"><h3 style="margin:0">Thông tin cá nhân</h3><div class="fgrid">
        <label>Họ và tên đệm <span class="req">*</span><input name="ho_ten_dem" required value="${esc(profile.ho_ten_dem)}"></label>
        <label>Tên <span class="req">*</span><input name="ten" required value="${esc(profile.ten)}"></label>
        <label class="full">Email<input readonly value="${esc(session.user.email)}"></label>
        <label>Số điện thoại <span class="req">*</span><input name="phone" required value="${esc(profile.phone)}"></label>
        <label>Công ty<input name="company" value="${esc(profile.company)}"></label>
        <label class="full">Địa chỉ<input name="address" value="${esc(profile.address)}"></label></div>
        <button class="btn primary" type="submit" style="margin-top:18px">Lưu thông tin</button></form>
      <form class="panel" id="pw"><h3 style="margin:0">Đổi mật khẩu</h3>
        <label>Mật khẩu mới<input type="password" name="p1" minlength="8" required autocomplete="new-password"></label>
        <label>Nhập lại<input type="password" name="p2" minlength="8" required autocomplete="new-password"></label>
        <button class="btn primary" type="submit" style="margin-top:18px">Đổi mật khẩu</button></form></div>`;
    $("#pf", m).onsubmit = async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
      const { error } = await sb.from("profiles").update(f).eq("id", session.user.id);
      if (error) return toast(error.message, true); Object.assign(profile, f); showName(); toast("Đã lưu thông tin.");
    };
    $("#pw", m).onsubmit = async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); if (f.p1 !== f.p2) return toast("Hai mật khẩu không khớp.", true);
      const { error } = await sb.auth.updateUser({ password: f.p1 }); if (error) return toast(error.message, true); e.target.reset(); toast("Đã đổi mật khẩu.");
    };
  }

  start();
})();
