import { initRonna } from "./utils/ronnaBase.js";
import { saveDoc, getUserDocs, tsToString } from "./services/firestoreService.js";
import { apiFetch } from "./config/env.js";
import { toast } from "./utils/toast.js";
import { gate } from "./services/paywallUI.js";
import { downloadText, setLoading, formatNumber } from "./utils/helpers.js";


let results = [];
let currentUser = null;

initRonna({ usageAction: "researches" }).then(user => {
  currentUser = user;
  if (user) loadHistory();
});

let profile = null;
document.getElementById("btn-research").addEventListener("click", () => {
  const prospect = document.getElementById("filter-company").value.trim();
  if (!prospect) return toast.warning("Enter a company name or domain.");
  gate("researches", () => runResearch(prospect), () => {});
});

async function runResearch(prospect) {
  document.querySelector(".btn-text").classList.add("hidden");
  document.querySelector(".btn-loader").classList.remove("hidden");
  document.getElementById("btn-research").disabled = true;

  try {
    const data = await apiFetch("/api/prospects/research", {
      company: prospect,
      depth: document.getElementById("filter-depth")?.value,
      focus: document.getElementById("filter-focus")?.value
    });
    profile = data?.profile || null;
  } catch {
    profile = null;
  }

  if (profile) renderProfile(profile); else showUnavailable();
  document.querySelector(".btn-text").classList.remove("hidden");
  document.querySelector(".btn-loader").classList.add("hidden");
  document.getElementById("btn-research").disabled = false;
}

function renderProfile(p) {
  document.getElementById("prospect-report").innerHTML = `
    <div class="profile-header">
      <div class="profile-logo">${p.name?.charAt(0) || "?"}</div>
      <div>
        <h2 class="profile-name">${p.name}</h2>
        <p class="profile-tagline">${p.tagline || ""}</p>
        <div class="profile-tags">
          ${(p.tags || []).map(t => `<span class="tag tag-blue">${t}</span>`).join("")}
        </div>
      </div>
    </div>
    <div class="profile-grid">
      <div class="profile-section"><h4>Overview</h4>
        <div class="profile-rows">
          <div class="profile-row"><span>Industry</span><strong>${p.industry || "—"}</strong></div>
          <div class="profile-row"><span>Founded</span><strong>${p.founded || "—"}</strong></div>
          <div class="profile-row"><span>Employees</span><strong>${p.employees || "—"}</strong></div>
          <div class="profile-row"><span>Revenue</span><strong>${p.revenue || "—"}</strong></div>
          <div class="profile-row"><span>HQ</span><strong>${p.location || "—"}</strong></div>
          <div class="profile-row"><span>Website</span><strong>${p.website || "—"}</strong></div>
        </div>
      </div>
      <div class="profile-section"><h4>Tech Stack</h4>
        <div class="tags-wrap">${(p.techStack || []).map(t => `<span class="tag tag-gray">${t}</span>`).join("") || "—"}</div>
      </div>
      <div class="profile-section"><h4>Funding</h4>
        <div class="profile-rows">
          <div class="profile-row"><span>Stage</span><strong>${p.fundingStage || "—"}</strong></div>
          <div class="profile-row"><span>Total</span><strong>${p.totalFunding || "—"}</strong></div>
          <div class="profile-row"><span>Last Round</span><strong>${p.lastRound || "—"}</strong></div>
        </div>
      </div>
      <div class="profile-section"><h4>Signals</h4>
        <ul class="signals-list">${(p.signals || []).map(s => `<li>${s}</li>`).join("") || "<li>No signals found</li>"}</ul>
      </div>
    </div>`;
  document.getElementById("results-panel").classList.remove("hidden");
  document.getElementById("results-panel").scrollIntoView({ behavior: "smooth" });
}

document.getElementById("btn-export")?.addEventListener("click", () => {
  if (!profile) return;
  const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: `${profile.name || "prospect"}.json` }).click();
});

document.getElementById("btn-save")?.addEventListener("click", async () => {
  if (!profile) return;
  await saveToFirestore("prospect-profiles", { profile, company: profile.name });
  loadHistory(); toast.success("Saved!");
});

async function loadHistory() {
  const grid = document.getElementById("history-grid");
  if (!grid) return; // no history UI on this page
  const items = await getFromFirestore("prospect-profiles");
  document.getElementById("history-section").classList.remove("hidden");
  grid.innerHTML = items.length
    ? items.map(i => `<div class="result-card"><strong>${i.company || "Profile"}</strong><small>${i.createdAt?.toDate?.().toLocaleDateString?.() || "Recently"}</small></div>`).join("")
    : "<p class='empty-state'>No saved profiles yet.</p>";
}

// RONNA-MOCK-FALLBACK: never fabricate results when the scanner API is unavailable.
function showUnavailable() {
  // Render into the report container so the Export/Save toolbar stays intact for a retry.
  profile = null;
  document.getElementById("results-panel")?.classList.remove("hidden");
  const report = document.getElementById("prospect-report");
  if (report) report.innerHTML = '<div class="empty-state" role="status"><p><strong>The scanner service is unavailable right now.</strong></p><p>No results were generated. Please try again later.</p></div>';
  toast.error("Scanner service unavailable. No results were generated.");
}
