/* TS TOOLS – Swarm mode (quay video "nhiều agent cùng dựng trang").
   Chỉ nạp khi URL có ?swarm=1. Tham số: agents=8 · sec=25 · labels=0|1 · code=0|1 · con=left · names=a,b,c · delay=1.5
   Phím: Shift+S chạy lại · Esc dừng (hiện lại toàn bộ).
   Không đổi dữ liệu / đăng nhập – chỉ ẩn / hiện phần tử trên màn hình. */
(function () {
  "use strict";
  const Q = new URLSearchParams(location.search);
  if (!Q.has("swarm")) return;
  const num = (k, d, a, b) => Math.max(a, Math.min(b, +Q.get(k) || d));
  const OPT = {
    agents: num("agents", 8, 1, 24), sec: num("sec", 25, 5, 600), delay: num("delay", 1.5, 0, 30),
    labels: Q.get("labels") === "1", code: Q.get("code") !== "0", conLeft: Q.get("con") === "left",
    names: (Q.get("names") || "").split(",").map(s => s.trim()).filter(Boolean)
  };
  const PAL = ["#ff4d4f", "#1677ff", "#52c41a", "#fa8c16", "#722ed1", "#13c2c2", "#eb2f96", "#fadb14", "#2f54eb", "#a0d911", "#fa541c", "#08979c"];
  const CYCLE = 0.55;   // giây / lần bấm (ước lượng để chia lô)

  // ---------- CSS ----------
  const css = document.createElement("style");
  css.textContent = `
  .sw-h{visibility:hidden!important}
  .sw-v{visibility:visible!important}
  .sw-in{animation:swIn .45s cubic-bezier(.2,.8,.2,1) both}
  @keyframes swIn{from{opacity:0;transform:scale(.97);filter:blur(2px)}to{opacity:1;transform:none;filter:none}}
  .sw-flash{outline:2px solid var(--sw-c);outline-offset:2px;transition:outline-color .6s}
  #sw-layer{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:2147483600}
  .sw-cur{position:absolute;left:0;top:0;will-change:transform}
  .sw-cur svg{width:22px;height:30px;filter:drop-shadow(1px 2px 1.5px rgba(0,0,0,.35));transition:transform .12s}
  .sw-cur.click svg{transform:scale(.86)}
  .sw-cur b{position:absolute;left:15px;top:23px;font:700 11px/1 "Be Vietnam Pro",Segoe UI,sans-serif;color:#fff;padding:4px 7px;border-radius:6px;white-space:nowrap}
  .sw-rip{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;border:2px solid;border-radius:50%;animation:swRip .45s ease-out forwards}
  @keyframes swRip{to{transform:scale(4.2);opacity:0}}
  #sw-con{position:fixed;right:16px;bottom:16px;width:min(460px,calc(100vw - 32px));height:min(300px,42vh);z-index:2147483601;
    background:#1e1e1e;border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.45);overflow:hidden;font:12.5px/1.55 "JetBrains Mono",Consolas,monospace;color:#d4d4d4;
    transition:opacity .8s}
  #sw-con .bar{height:28px;background:#252526;display:flex;align-items:center;gap:7px;padding:0 10px;color:#ccc;font-size:12px}
  #sw-con .bar i{width:11px;height:11px;border-radius:50%;display:inline-block}
  #sw-con .bar span{margin-left:8px}
  #sw-con pre{margin:0;padding:6px 10px 8px 0;height:calc(100% - 28px);overflow:hidden;white-space:pre}
  #sw-con .ln{display:inline-block;width:38px;text-align:right;color:#6e7681;margin-right:12px;user-select:none}
  #sw-con .k{color:#569cd6}#sw-con .t{color:#4ec9b0}#sw-con .a{color:#9cdcfe}#sw-con .s{color:#ce9178}#sw-con .n{color:#b5cea8}#sw-con .c{color:#6a9955}#sw-con .f{color:#dcdcaa}#sw-con .ok{color:#4ec978}
  #sw-con .caret{display:inline-block;width:7px;height:1.1em;background:#d4d4d4;vertical-align:text-bottom;animation:swBlink 1s steps(1) infinite}
  @keyframes swBlink{50%{opacity:0}}
  @media (max-width:640px){#sw-con{height:30vh;font-size:11px}}`;
  document.head.appendChild(css);

  // ---------- trạng thái ----------
  let units = [], taken = [], next = 0, left = 0, running = false, t0 = 0, raf = 0, curs = [], layer = null, con = null, mo = null, done = 0, total = 0, doneAt = -1;
  const ours = el => el.closest && el.closest("#sw-layer,#sw-con");
  const now = () => performance.now() / 1000;
  const rnd = (a, b) => a + Math.random() * (b - a);

  /** Phần tử "đơn vị dựng": theo thứ tự DOM (cha trước con) – bỏ phần trong SVG, phần không có kích thước. */
  function collect(root) {
    const list = [];
    const walk = el => {
      if (el.nodeType !== 1 || ours(el) || /^(SCRIPT|STYLE|LINK|META|TEMPLATE|NOSCRIPT|BR)$/.test(el.tagName)) return;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || getComputedStyle(el).display === "none") return;
      list.push(el);
      if (el.tagName === "svg" || el.tagName === "SVG" || el.tagName === "SELECT") return;   // svg / select: 1 khối
      for (const c of el.children) walk(c);
    };
    for (const c of root.children) walk(c);
    return list;
  }
  /** Khối nền lớn (che > nửa màn hình): giữ nguyên làm "nền công trường", chỉ dựng nội dung bên trên. */
  const big = el => { const r = el.getBoundingClientRect(); return r.width * r.height > innerWidth * innerHeight * 0.5; };
  const hideAll = list => list.forEach(el => { el.classList.add("sw-h"); el.classList.remove("sw-v", "sw-in"); });

  function start() {
    stop(true);
    units = collect(document.body).filter(e => !big(e)); taken = units.map(() => false); next = 0; left = total = units.length; done = 0; doneAt = -1;
    if (!total) return;
    hideAll(units);
    document.documentElement.style.scrollBehavior = "auto"; window.scrollTo(0, 0);
    layer = document.createElement("div"); layer.id = "sw-layer"; document.body.appendChild(layer);
    const names = Array.from({ length: OPT.agents }, (_, i) => OPT.names.length > 1 ? (OPT.names[i] || OPT.names[i % OPT.names.length] + " " + (Math.floor(i / OPT.names.length) + 1)) : (OPT.names[0] || "Agent") + " " + (i + 1));
    curs = names.map((n, i) => {
      const el = document.createElement("div"); el.className = "sw-cur"; const col = PAL[i % PAL.length];
      el.innerHTML = `<svg viewBox="0 0 13 20"><path d="M0 0v17l4.2-3.8 3 6.4 3-1.3-3-6.2h5.4z" fill="${col}" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/></svg>` + (OPT.labels ? `<b style="background:${col}">${n}</b>` : "");
      layer.appendChild(el);
      const p = { x: rnd(0.1, 0.9) * innerWidth, y: rnd(0.1, 0.9) * innerHeight };
      return { el, col, name: n, p, a: p, b: p, c1: p, t0: 0, dur: 0, wait: rnd(0, .5), phase: 2, unit: null };
    });
    if (OPT.code) openConsole();
    // phần tử app vẽ thêm khi đang chạy (dữ liệu tải về) → ẩn và đưa vào hàng
    mo = new MutationObserver(ms => {
      if (!running) return;
      for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && !ours(n)) {
        const add = []; const w = e => { if (e.nodeType !== 1) return; if (!big(e)) add.push(e); if (e.tagName !== "svg") for (const c of e.children) w(c); }; w(n);
        hideAll(add); for (const e of add) { units.push(e); taken.push(false); } left += add.length; total += add.length;
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    running = true; t0 = now(); raf = requestAnimationFrame(frame);
    log(`$ ts-swarm build ${location.pathname.split("/").filter(Boolean).pop() || "index.html"} --agents ${OPT.agents} --time ${OPT.sec}s`);
    log(`▸ plan: ${total} nodes · ${document.querySelectorAll("section,header,main,form").length} sections · ${document.styleSheets.length} stylesheets`);
    log(`▸ spawn ${OPT.agents} agents: ${names.slice(0, 6).join(", ")}${names.length > 6 ? ", …" : ""}`);
  }

  function stop(silent) {
    running = false; cancelAnimationFrame(raf); mo && mo.disconnect(); mo = null;
    document.querySelectorAll(".sw-h,.sw-v,.sw-in,.sw-flash").forEach(e => e.classList.remove("sw-h", "sw-v", "sw-in", "sw-flash"));
    layer && layer.remove(); layer = null; curs = [];
    if (silent) { con && con.remove(); con = null; }
  }

  /** Con trỏ xin việc: lô liền nhau, bắt đầu ngẫu nhiên trong "vùng đang dựng" đầu hàng → tỏa ra, vẫn dựng trên → dưới, cha → con. */
  function take() {
    if (left <= 0) return null;
    const tl = Math.max(0.4, OPT.sec - (now() - t0));
    const clicks = Math.max(1, OPT.agents * tl / CYCLE);
    const n = Math.min(left, Math.max(1, Math.ceil(left / clicks)));
    const win = Math.max(12, n * OPT.agents * 2);
    let skip = Math.floor(Math.random() * Math.max(1, Math.min(win, left) - n + 1)), i = next;
    for (; i < units.length; i++) if (!taken[i] && skip-- <= 0) break;
    if (i >= units.length) i = next;
    const out = [];
    for (; i < units.length && out.length < n; i++) if (!taken[i]) { taken[i] = true; out.push(units[i]); }
    for (let j = next; j < units.length && out.length < n; j++) if (!taken[j]) { taken[j] = true; out.push(units[j]); }
    left -= out.length; while (next < units.length && taken[next]) next++;
    return out;
  }

  /** Điểm bấm trên khối (viewport): khối nhỏ → giữa; khối lớn → góc trên-trái bên trong (như kéo khung). */
  function aim(el) {
    const r = el.getBoundingClientRect();
    if (r.width > 260 || r.height > 160) return { x: r.left + Math.min(r.width * .5, 60 + Math.random() * 80), y: r.top + Math.min(r.height * .5, 24 + Math.random() * 30) };
    return { x: r.left + r.width * rnd(.35, .65), y: r.top + r.height * rnd(.35, .65) };
  }

  function reveal(list, c) {
    for (const el of list) {
      el.classList.remove("sw-h"); el.classList.add("sw-v", "sw-in");
      // chữ tự gõ: phần tử chỉ chứa 1 đoạn chữ
      if (el.childNodes.length === 1 && el.firstChild.nodeType === 3 && !/^(INPUT|TEXTAREA|SELECT|OPTION)$/.test(el.tagName)) {
        const full = el.firstChild.nodeValue; if (full.trim().length > 1 && full.length < 160) {
          let k = 0; const step = Math.max(1, Math.ceil(full.length / 22)); el.firstChild.nodeValue = "";
          const tm = setInterval(() => { k += step; if (!el.firstChild) return clearInterval(tm); el.firstChild.nodeValue = full.slice(0, k); if (k >= full.length) clearInterval(tm); }, 28);
        }
      }
    }
    done += list.length;
    const head = list[0];
    if (head && c) { head.style.setProperty("--sw-c", c.col); head.classList.add("sw-flash"); setTimeout(() => head.classList.remove("sw-flash"), 500); code(head, c); }
  }

  // ---------- camera: cuộn theo vùng đang dựng ----------
  function camera(dt) {
    if (next >= units.length) return;
    let el = units[next]; const r = el.getBoundingClientRect();
    const want = scrollY + r.top - innerHeight * 0.28;
    const max = document.documentElement.scrollHeight - innerHeight;
    const target = Math.max(0, Math.min(max, want));
    if (Math.abs(target - scrollY) > 2) window.scrollTo(0, scrollY + (target - scrollY) * Math.min(1, dt * 2.2));
  }

  let last = 0;
  function frame() {
    if (!running) return;
    const t = now() - t0, dt = Math.min(0.1, t - last); last = t;
    camera(dt);
    curs.forEach((c, i) => step(c, i, t));
    if (doneAt < 0 && left <= 0 && curs.every(c => !c.unit)) { doneAt = t; finish(); }
    if (doneAt >= 0 && t - doneAt > 1.6) { layer && (layer.style.transition = "opacity .8s", layer.style.opacity = "0"); if (t - doneAt > 2.6) { stop(false); return; } }
    raf = requestAnimationFrame(frame);
  }

  function step(c, i, t) {
    if (c.phase === 0) {
      if (c.unit) { const p = aimLive(c); if (p) c.b = p; }   // trang cuộn → bám theo
      const u = Math.min(1, (t - c.t0) / c.dur), e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2, m = 1 - e;
      c.p = { x: m * m * c.a.x + 2 * m * e * c.c1.x + e * e * c.b.x, y: m * m * c.a.y + 2 * m * e * c.c1.y + e * e * c.b.y };
      if (u >= 1) {
        c.p = c.b;
        if (c.unit) { reveal(c.unit, c); ripple(c); c.unit = null; }
        c.phase = 1; c.t0 = t; c.wait = rnd(.05, .25);
        c.el.classList.add("click"); setTimeout(() => c.el.classList.remove("click"), 120);
      }
    } else if (t - c.t0 >= c.wait) {
      const u = take();
      if (u && u.length) { c.unit = u; c.off = { x: rnd(-6, 6), y: rnd(-6, 6) }; go(c, aimLive(c, true), t); }
      else if (doneAt < 0 || t - doneAt < 1.2) go(c, { x: clamp(c.p.x + rnd(-140, 140), 10, innerWidth - 30), y: clamp(c.p.y + rnd(-100, 100), 10, innerHeight - 30) }, t);
    }
    c.el.style.transform = `translate(${c.p.x}px,${c.p.y}px)`;
  }
  function aimLive(c, fresh) {
    if (fresh || !c.aimRel) { const el = c.unit[0], r = el.getBoundingClientRect(), p = aim(el); c.aimRel = { el, dx: p.x - r.left, dy: p.y - r.top }; }
    const r = c.aimRel.el.getBoundingClientRect();
    return { x: clamp(r.left + c.aimRel.dx + c.off.x, 4, innerWidth - 20), y: clamp(r.top + c.aimRel.dy + c.off.y, 4, innerHeight - 24) };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function go(c, to, t) {
    c.a = c.p; c.b = to; c.t0 = t; c.phase = 0; if (!c.unit) c.aimRel = null;
    const dx = to.x - c.p.x, dy = to.y - c.p.y, d = Math.hypot(dx, dy);
    c.dur = clamp(0.12 + d / 1500, 0.16, 0.7);
    const bend = rnd(-.18, .18); c.c1 = { x: (c.a.x + c.b.x) / 2 - dy * bend, y: (c.a.y + c.b.y) / 2 + dx * bend };
  }
  function ripple(c) {
    if (!layer) return; const r = document.createElement("div"); r.className = "sw-rip";
    r.style.cssText = `left:${c.p.x}px;top:${c.p.y}px;border-color:${c.col}`; layer.appendChild(r); setTimeout(() => r.remove(), 500);
  }

  // ---------- khung code tự chạy ----------
  let pend = [], typing = null, typed = "", lines = [], lineNo = 0, conTm = 0;
  function openConsole() {
    con && con.remove();
    con = document.createElement("div"); con.id = "sw-con"; if (OPT.conLeft) { con.style.right = "auto"; con.style.left = "16px"; }
    con.innerHTML = `<div class="bar"><i style="background:#ff5f56"></i><i style="background:#ffbd2e"></i><i style="background:#27c93f"></i><span>index.html — TS Agent</span></div><pre></pre>`;
    document.body.appendChild(con);
    pend = []; typing = null; typed = ""; lines = []; lineNo = 0;
    clearInterval(conTm); conTm = setInterval(typeTick, 16);
  }
  function log(s, col) { if (!OPT.code) return; pend.push({ s, col }); if (pend.length > 60) { const x = pend.shift(); lines.push(x); lineNo++; } }
  function typeTick() {
    if (!con) return clearInterval(conTm);
    if (!typing) { if (!pend.length) return paint(); typing = pend.shift(); typed = ""; }
    const backlog = pend.reduce((a, p) => a + p.s.length, 0) + typing.s.length - typed.length;
    typed = typing.s.slice(0, typed.length + Math.max(2, Math.min(40, Math.floor(backlog / 25))));
    if (typed.length >= typing.s.length) { lines.push(typing); lineNo++; typing = null; if (lines.length > 300) lines.splice(0, 100); }
    paint();
  }
  function paint() {
    const pre = con.querySelector("pre"); const rows = Math.max(3, Math.floor(pre.clientHeight / 19.4));
    const all = lines.slice(-(rows - 1)); const cur = typing ? { s: typed, col: typing.col } : { s: "" };
    let no = lineNo - all.length + 1;
    pre.innerHTML = all.map(l => `<span class="ln">${no++}</span>${hl(l.s, l.col)}`).join("\n") + `\n<span class="ln">${no}</span>${hl(cur.s, cur.col)}<span class="caret"></span>`;
  }
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  /** Tô màu gọn: $ lệnh · ▸ ghi chú · ✓ · // chú thích ([agent] theo màu con trỏ) · thẻ HTML · CSS. */
  function hl(s, col) {
    if (s.startsWith("$")) return `<span class="ok">$</span>${esc(s.slice(1))}`;
    if (s.startsWith("✓")) return `<span class="ok">${esc(s)}</span>`;
    if (s.startsWith("▸")) return `<span class="t">▸</span><span class="c" style="color:#8b949e">${esc(s.slice(1))}</span>`;
    const ci = s.indexOf("//");
    if (ci >= 0) {
      const head = s.slice(0, ci), cm = s.slice(ci), a = cm.indexOf("["), b = cm.indexOf("]");
      const cmH = a >= 0 && b > a && col ? `<span class="c">${esc(cm.slice(0, a))}</span><span style="color:${col}">${esc(cm.slice(a, b + 1))}</span><span class="c">${esc(cm.slice(b + 1))}</span>` : `<span class="c">${esc(cm)}</span>`;
      return hl(head) + cmH;
    }
    let out = "", i = 0;
    const re = /(<\/?)([\w-]+)|([\w-]+)(=)("[^"]*"?)|("[^"]*"?)|(-?\d+(?:\.\d+)?(?:px|rem|em|%|s|deg)?)|([.#][\w-]+)(?=[^"]*\{|\s*\{)|([\w-]+)(?=\s*:)|(\/?>)/g;
    let m;
    while ((m = re.exec(s))) {
      out += esc(s.slice(i, m.index)); i = re.lastIndex;
      if (m[2]) out += `<span class="k">${esc(m[1])}</span><span class="k">${m[2]}</span>`;
      else if (m[3]) out += `<span class="a">${m[3]}</span>=<span class="s">${esc(m[5])}</span>`;
      else if (m[6]) out += `<span class="s">${esc(m[6])}</span>`;
      else if (m[7]) out += `<span class="n">${m[7]}</span>`;
      else if (m[8]) out += `<span class="f">${m[8]}</span>`;
      else if (m[9]) out += `<span class="a">${m[9]}</span>`;
      else if (m[10]) out += `<span class="k">${esc(m[10])}</span>`;
    }
    return out + esc(s.slice(i));
  }
  /** Code của khối vừa dựng: thẻ HTML thật (id, class, chữ) + vài thuộc tính CSS thật (khối có nền / bo góc). */
  function code(el, c) {
    if (!OPT.code) return;
    const tag = el.tagName.toLowerCase(), cls = typeof el.className === "string" ? el.className.split(/\s+/).filter(x => x && !x.startsWith("sw-")).slice(0, 2).join(" ") : "";
    const txt = (el.innerText || el.getAttribute("placeholder") || el.getAttribute("alt") || "").trim().split("\n")[0].slice(0, 34);
    const attrs = (el.id ? ` id="${el.id}"` : "") + (cls ? ` class="${cls}"` : "") + (el.getAttribute("href") ? ` href="${el.getAttribute("href").slice(0, 24)}"` : "") + (el.getAttribute("type") ? ` type="${el.getAttribute("type")}"` : "");
    const pct = Math.round(Math.min(done, total) / Math.max(1, total) * 100);
    log(`// [${c.name}] <${tag}${el.id ? "#" + el.id : ""}> · ${pct}%`, c.col);
    if (tag === "svg") log(`<svg viewBox="${el.getAttribute("viewBox") || "0 0 24 24"}"><path d="…"/></svg>`);
    else if (tag === "img") log(`<img src="${(el.getAttribute("src") || "").slice(0, 28)}" alt="${(el.alt || "").slice(0, 20)}">`);
    else if (/^(input|textarea|select)$/.test(tag)) log(`<${tag}${attrs}${el.placeholder ? ` placeholder="${el.placeholder.slice(0, 24)}"` : ""}>`);
    else log(`<${tag}${attrs}>${txt && el.children.length < 3 ? txt + `</${tag}>` : ""}`);
    const st = getComputedStyle(el), r = el.getBoundingClientRect();
    const bg = st.backgroundColor, rad = st.borderTopLeftRadius;
    if ((bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") || (rad && rad !== "0px") || st.backdropFilter && st.backdropFilter !== "none") {
      const sel = el.id ? "#" + el.id : cls ? "." + cls.split(" ")[0] : tag;
      log(`${sel} { width: ${Math.round(r.width)}px; border-radius: ${rad}; ${st.display === "flex" || st.display === "grid" ? "display: " + st.display + "; " : ""}}`);
    }
  }
  function finish() {
    log(`✓ build complete · ${total} nodes · ${OPT.agents} agents · ${(now() - t0).toFixed(1)}s`);
    setTimeout(() => { if (con && !running) { con.style.opacity = "0"; setTimeout(() => { con && con.remove(); con = null; }, 900); } }, 6000);
  }

  // ---------- phím ----------
  addEventListener("keydown", e => {
    if (e.key === "Escape" && running) { stop(true); }
    else if (e.key === "S" && e.shiftKey && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) start();
  });
  // chờ trang hiện thật (app kiểm tra đăng nhập xong mới bỏ .hidden) rồi mới dựng
  const go0 = () => setTimeout(function wait(n) {
    n = n || 0;
    const vis = collect(document.body).length;
    if (vis >= 15 || n > 50) start(); else setTimeout(() => wait(n + 1), 200);
  }, OPT.delay * 1000);
  if (document.readyState === "complete") go0(); else addEventListener("load", go0);
})();
