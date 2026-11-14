import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const configured = SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("VOTRE-PROJET") &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes("VOTRE_CLE");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = (id) => document.getElementById(id);

function message(id, text, type = "") {
  const el = $(id); el.textContent = text; el.className = `form-message ${type}`;
}
function avg(r) { return ((r.quality + r.comfort + r.speed + r.experience) / 4).toFixed(1); }
function date(v) { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(v)); }

function cell(text) {
  const td = document.createElement("td");
  td.textContent = text ?? "";
  return td;
}

async function loadDashboard() {
  message("admin-message", "Chargement du registre…");
  const [ratingsResult, statsResult] = await Promise.all([
    supabase.from("ratings").select("id,name,quality,comfort,speed,experience,comment,created_at")
      .order("created_at", { ascending: false }).limit(500),
    supabase.rpc("get_public_stats")
  ]);
  if (ratingsResult.error || statsResult.error) {
    const error = ratingsResult.error || statsResult.error;
    message("admin-message", `Erreur : ${error.message}`, "error");
    return;
  }
  const rows = ratingsResult.data || [];
  const stats = statsResult.data?.[0];
  $("admin-total").textContent = stats?.total_visits ?? "0";
  $("admin-average").textContent = `${Number(stats?.avg_score ?? 0).toFixed(1)}/10`;
  $("admin-people").textContent = stats?.participant_count ?? "0";
  const body = $("ratings-table");
  body.replaceChildren();
  if (!rows.length) {
    const tr = document.createElement("tr"); const td = cell("Aucun passage enregistré."); td.colSpan = 9; tr.append(td); body.append(tr);
  } else {
    rows.forEach(r => {
      const tr = document.createElement("tr");
      [date(r.created_at), r.name, `${r.quality}/10`, `${r.comfort}/10`, `${r.speed}/10`, `${r.experience}/10`, `${avg(r)}/10`, r.comment || "—"].forEach(v => tr.append(cell(v)));
      const action = document.createElement("td");
      const del = document.createElement("button");
      del.className = "delete-button"; del.type = "button"; del.textContent = "Supprimer";
      del.addEventListener("click", async () => {
        if (!window.confirm(`Supprimer définitivement le passage de ${r.name} ?`)) return;
        del.disabled = true;
        const { error: deleteError } = await supabase.from("ratings").delete().eq("id", r.id);
        if (deleteError) { message("admin-message", `Suppression impossible : ${deleteError.message}`, "error"); del.disabled = false; }
        else { message("admin-message", "Passage supprimé.", "success"); await loadDashboard(); }
      });
      action.append(del); tr.append(action); body.append(tr);
    });
  }
  message("admin-message", `${rows.length} passage(s) récent(s) affiché(s), sur ${stats?.total_visits ?? rows.length} au total.`, "success");
}

function showDashboard() {
  $("login-panel").classList.add("hidden");
  $("dashboard").classList.remove("hidden");
  loadDashboard();
}

if (!supabase) {
  message("login-message", "Configurez d'abord config.js avec les identifiants publics Supabase.", "error");
} else {
  $("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("login-form").querySelector("button");
    button.disabled = true;
    message("login-message", "Vérification…");
    const { error } = await supabase.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });
    button.disabled = false;
    if (error) { message("login-message", "Connexion refusée. Vérifiez l'adresse et le mot de passe.", "error"); return; }
    showDashboard();
  });

  $("logout-button").addEventListener("click", async () => {
    await supabase.auth.signOut();
    $("dashboard").classList.add("hidden");
    $("login-panel").classList.remove("hidden");
    $("password").value = "";
  });
  $("refresh-button").addEventListener("click", loadDashboard);

  supabase.auth.getSession().then(({ data }) => {
    if (data.session) showDashboard();
  });
}
