import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const configured = SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("VOTRE-PROJET") &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes("VOTRE_CLE");

const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = (id) => document.getElementById(id);
const form = $("rating-form");

function showMessage(message, type = "") {
  const node = $("form-message");
  node.textContent = message;
  node.className = `form-message ${type}`;
}

function average(row) {
  return ((row.quality + row.comfort + row.speed + row.experience) / 4).toFixed(1);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function safeText(value) {
  return String(value ?? "");
}

function setupSliders() {
  ["quality", "comfort", "speed", "experience"].forEach((id) => {
    const slider = $(id);
    const output = $(`${id}-value`);
    const update = () => { output.value = `${slider.value}/10`; output.textContent = `${slider.value}/10`; };
    slider.addEventListener("input", update);
    update();
  });
}

function renderLeaderboard(rows) {
  const host = $("leaderboard");
  if (!rows?.length) {
    host.innerHTML = '<p class="empty-state">Le trône est encore libre. Soyez le premier à entrer dans la légende.</p>';
    return;
  }
  host.replaceChildren();
  rows.forEach((person, index) => {
    const item = document.createElement("div");
    item.className = "leader-row";
    const rank = document.createElement("span");
    rank.className = `rank rank-${index + 1}`;
    rank.textContent = String(index + 1).padStart(2, "0");
    const info = document.createElement("div");
    info.className = "leader-info";
    const name = document.createElement("strong");
    name.textContent = safeText(person.name);
    const detail = document.createElement("small");
    detail.textContent = `${person.visits} passage${person.visits > 1 ? "s" : ""}`;
    info.append(name, detail);
    const score = document.createElement("b");
    score.className = "leader-score";
    score.textContent = `${Number(person.avg_score).toFixed(1)}`;
    const suffix = document.createElement("small");
    suffix.className = "score-suffix";
    suffix.textContent = "/10";
    const scoreWrap = document.createElement("div");
    scoreWrap.className = "score-wrap";
    scoreWrap.append(score, suffix);
    item.append(rank, info, scoreWrap);
    host.append(item);
  });
}

function renderReviews(rows) {
  const host = $("recent-reviews");
  if (!rows?.length) {
    host.innerHTML = '<p class="empty-state">Aucun commentaire pour le moment. Le livre d’or attend son premier critique.</p>';
    return;
  }
  host.replaceChildren();
  rows.forEach((review) => {
    const article = document.createElement("article");
    article.className = "review";
    const top = document.createElement("div");
    top.className = "review-top";
    const name = document.createElement("strong");
    name.textContent = safeText(review.name);
    const score = document.createElement("span");
    score.textContent = `${Number(review.avg_score).toFixed(1)}/10`;
    top.append(name, score);
    const comment = document.createElement("p");
    comment.textContent = safeText(review.comment);
    const date = document.createElement("small");
    date.textContent = formatDate(review.created_at);
    article.append(top, comment, date);
    host.append(article);
  });
}

async function loadPublicData() {
  if (!supabase) {
    $("leaderboard").textContent = "Configuration requise : renseignez config.js et exécutez le SQL Supabase.";
    $("recent-reviews").textContent = "Le livre d'or sera disponible après configuration.";
    showMessage("Le site est prêt, mais la connexion Supabase n'est pas encore configurée.", "error");
    return;
  }
  const [statsResult, leaderboardResult, reviewsResult] = await Promise.all([
    supabase.rpc("get_public_stats"),
    supabase.rpc("get_public_leaderboard"),
    supabase.rpc("get_recent_reviews")
  ]);
  if (statsResult.error || leaderboardResult.error || reviewsResult.error) {
    const error = statsResult.error || leaderboardResult.error || reviewsResult.error;
    showMessage(`Impossible de charger le registre : ${error.message}`, "error");
    return;
  }
  const stats = statsResult.data?.[0];
  $("total-visits").textContent = stats?.total_visits ?? "0";
  $("global-average").innerHTML = `${stats ? Number(stats.avg_score).toFixed(1) : "—"}<small>/10</small>`;
  $("participant-count").textContent = stats?.participant_count ?? "0";
  renderLeaderboard(leaderboardResult.data);
  renderReviews(reviewsResult.data);
}

setupSliders();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) {
    showMessage("Le site n'est pas encore relié à sa base de données. Consulte le fichier README.", "error");
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  const name = $("visitor-name").value.trim();
  const comment = $("visitor-comment").value.trim();
  if (name.length < 2) return showMessage("Choisissez un prénom ou surnom d'au moins 2 caractères.", "error");
  if (!$("consent").checked) return showMessage("Merci de confirmer l'affichage public de votre surnom et de votre avis.", "error");

  button.disabled = true;
  button.querySelector("span").textContent = "ENREGISTREMENT…";
  showMessage("");
  const payload = {
    p_name: name,
    p_quality: Number($("quality").value),
    p_comfort: Number($("comfort").value),
    p_speed: Number($("speed").value),
    p_experience: Number($("experience").value),
    p_comment: comment || null
  };
  const { error } = await supabase.rpc("submit_rating", payload);
  button.disabled = false;
  button.querySelector("span").textContent = "ENREGISTRER MON VERDICT";
  if (error) {
    const msg = error.message.includes("attendre") ? error.message : "Le verdict n'a pas pu être enregistré. Réessayez dans un instant.";
    showMessage(msg, "error");
    return;
  }
  form.reset();
  ["quality", "comfort", "speed", "experience"].forEach((id, i) => {
    $(id).value = [7, 8, 7, 8][i];
    $(`${id}-value`).textContent = `${$(id).value}/10`;
  });
  showMessage("Verdict enregistré. Votre passage entre dans la légende. 💩", "success");
  await loadPublicData();
  window.scrollTo({ top: $("leaderboard").getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" });
});

loadPublicData();
