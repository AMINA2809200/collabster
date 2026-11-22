const SUPABASE_URL = "https://emhzokxaxppsojbfwykq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_KMpHfjv6ypeThMzzXe0Jng_sZ2mUpOM";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function ensureProfile(user) {
  const { data: existing } = await sb.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!existing) {
    await sb.from("profiles").insert({ id: user.id, name: (user.email || "").split("@")[0] });
  }
}

async function requireAuth() {
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    window.location.href = "auth.html";
    return null;
  }
  await ensureProfile(data.session.user);
  return data.session.user;
}

async function getMyProfile() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return null;
  const { data: profile } = await sb.from("profiles").select("*").eq("id", data.session.user.id).single();
  return profile;
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  for (const k in attrs || {}) {
    if (k === "class") node.className = attrs[k];
    else if (k === "html") node.innerHTML = attrs[k];
    else node.setAttribute(k, attrs[k]);
  }
  (children || []).forEach((c) => node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
  return node;
}

async function logout() {
  await sb.auth.signOut();
  window.location.href = "auth.html";
}

function customConfirm(message) {
  return new Promise((resolve) => {
    const overlay = el("div", { style: "position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:1000;" });
    overlay.innerHTML = `
      <div style="background:#fff;padding:20px;border-radius:10px;max-width:320px;text-align:center;">
        <p style="margin:0 0 16px;">${escapeHtml(message)}</p>
        <button id="ccYes">Да</button>
        <button id="ccNo" class="secondary">Отмена</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ccYes").onclick = () => { overlay.remove(); resolve(true); };
    overlay.querySelector("#ccNo").onclick = () => { overlay.remove(); resolve(false); };
  });
}

function customPrompt(message, options) {
  return new Promise((resolve) => {
    const overlay = el("div", { style: "position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:1000;" });
    const optionsHtml = options.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
    overlay.innerHTML = `
      <div style="background:#fff;padding:20px;border-radius:10px;max-width:320px;width:90%;">
        <p style="margin:0 0 10px;">${escapeHtml(message)}</p>
        <select id="cpSelect" style="width:100%;margin-bottom:12px;">${optionsHtml}</select>
        <div style="text-align:right;">
          <button id="cpCancel" class="secondary">Отмена</button>
          <button id="cpOk">Отправить</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#cpOk").onclick = () => {
      const v = overlay.querySelector("#cpSelect").value;
      overlay.remove();
      resolve(v);
    };
    overlay.querySelector("#cpCancel").onclick = () => { overlay.remove(); resolve(null); };
  });
}

async function uploadFile(bucket, userId, file) {
  const ext = file.name.split(".").pop();
  const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await sb.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

async function grantInvitesIfFirstTime(profileId) {
  const { data: asAuthor } = await sb.from("projects").select("id").eq("author_id", profileId).eq("status", "completed");
  const { data: asMember } = await sb.from("project_members").select("project_id, projects!inner(status)").eq("profile_id", profileId).eq("projects.status", "completed");
  const completedCount = (asAuthor ? asAuthor.length : 0) + (asMember ? asMember.length : 0);
  if (completedCount === 1) {
    const codes = [1, 2, 3].map(() => ({ code: Math.random().toString(36).slice(2, 8).toUpperCase(), created_by: profileId }));
    await sb.from("invites").insert(codes);
  }
}

function isVideoUrl(url) {
  return /\.(mp4|webm|mov|m4v)$/i.test(url || "");
}

function customAlert(message) {
  return new Promise((resolve) => {
    const overlay = el("div", { style: "position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:1000;" });
    overlay.innerHTML = `
      <div style="background:#fff;padding:20px;border-radius:10px;max-width:320px;text-align:center;">
        <p style="margin:0 0 16px;">${escapeHtml(message)}</p>
        <button id="caOk">ОК</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#caOk").onclick = () => { overlay.remove(); resolve(); };
  });
}
