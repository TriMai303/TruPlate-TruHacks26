let liveMenuSections = [];

document.querySelectorAll(".pref-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    chip.classList.toggle("active");
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const dateInput = document.getElementById("menuDate");
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  dateInput.value = localDate;

  document.getElementById("loadMenuBtn").addEventListener("click", loadLiveMenu);
  document.getElementById("generateBtn").addEventListener("click", generateMeal);
});

function valueOrNull(id) {
  const value = document.getElementById(id).value.trim();
  return value === "" ? null : Number(value);
}

function getSelectedPrefs() {
  return [...document.querySelectorAll(".pref-chip.active")].map((chip) => chip.dataset.val);
}

function showError(message) {
  const errorBox = document.getElementById("errorBox");
  errorBox.textContent = `⚠ ${message}`;
  errorBox.classList.add("visible");
}

function clearError() {
  document.getElementById("errorBox").classList.remove("visible");
}

function setLoading(isLoading) {
  const loading = document.getElementById("loading");
  const generateBtn = document.getElementById("generateBtn");

  if (isLoading) {
    loading.classList.add("visible");
    generateBtn.disabled = true;
  } else {
    loading.classList.remove("visible");
    generateBtn.disabled = false;
  }
}

async function loadLiveMenu() {
  clearError();

  const preview = document.getElementById("liveMenuPreview");
  const date = document.getElementById("menuDate").value;
  const selected = document.getElementById("mealPeriod").value;

  preview.innerHTML = "Loading live menu...";

  try {
    const res = await fetch(`http://localhost:3000/api/menu?date=${encodeURIComponent(date)}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to load menu.");
    }

    liveMenuSections = Array.isArray(data.sections) ? data.sections : [];

    if (!liveMenuSections.length) {
      preview.innerHTML = "No menu items found. Try again.";
      return;
    }

    // Filter by selected meal period
    const filtered = selected === "ALL"
      ? liveMenuSections
      : liveMenuSections.filter(s => s.section.toUpperCase() === selected);

    if (!filtered.length) {
      preview.innerHTML = "No items found for that meal period.";
      return;
    }

    preview.innerHTML = filtered
      .map((section) => {
        const items = (section.items || []).slice(0, 10).map(item => item.name).join(", ");
        const extra = (section.items || []).length > 10 ? " ..." : "";
        return `
          <div class="preview-section">
            <div class="preview-section-title">${escapeHtml(section.section || "Section")}</div>
            <div>${escapeHtml(items)}${extra}</div>
          </div>
        `;
      })
      .join("");

  } catch (err) {
    preview.innerHTML = "Could not load menu.";
    showError(err.message || "Something went wrong while loading the menu.");
  }
}

async function generateMeal() {
  clearError();
  document.getElementById("result").classList.remove("visible");

  if (!liveMenuSections.length) {
    showError("Please load the live menu first.");
    return;
  }

  const goals = {
    calories: valueOrNull("calories"),
    protein: valueOrNull("protein"),
    carbs: valueOrNull("carbs"),
    fat: valueOrNull("fat"),
    fiber: valueOrNull("fiber"),
    mealPeriod: document.getElementById("mealPeriod").value || "ALL"
  };

  const hasAnyGoal = Object.entries(goals).some(([key, value]) => {
    if (key === "mealPeriod") return false;
    return value !== null;
  });

  if (!hasAnyGoal) {
    showError("Please enter at least one nutrition goal.");
    return;
  }

  const filteredSections =
    goals.mealPeriod === "ALL"
      ? liveMenuSections
      : liveMenuSections.filter((section) =>
          (section.section || "").toUpperCase().includes(goals.mealPeriod)
        );

  if (!filteredSections.length) {
    showError("No menu items found for that meal period.");
    return;
  }

  setLoading(true);

  try {
    const res = await fetch("http://localhost:3000/api/generate-meal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        menuSections: filteredSections,
        goals,
        preferences: getSelectedPrefs()
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Meal generation failed.");
    }

    renderResult(data);
  } catch (err) {
    showError(err.message || "Something went wrong while generating the meal.");
  } finally {
    setLoading(false);
  }
}

function renderResult(data) {
  const result = document.getElementById("result");
  const body = document.getElementById("resultBody");

  const mealItems = Array.isArray(data.mealItems) ? data.mealItems : [];
  const totals = data.estimatedTotals || {};
  const goalMatch = data.goalMatch || "";
  const tips = Array.isArray(data.tips) ? data.tips : [];

  let html = "";

  html += "<h3>🍽 Recommended Meal</h3>";
  html += '<div class="meal-items">';

  if (mealItems.length) {
    mealItems.forEach((item) => {
      html += `
        <div class="meal-item">
          <div class="meal-item-dot"></div>
          <div class="meal-item-text">
            <strong>${escapeHtml(item.name || "Item")}</strong> — ${escapeHtml(item.portion || "1 serving")}
            <br>
            <span>${escapeHtml(item.reason || "")}</span>
          </div>
        </div>
      `;
    });
  } else {
    html += `
      <div class="meal-item">
        <div class="meal-item-dot"></div>
        <div class="meal-item-text">
          No meal items were returned. Try broader goals.
        </div>
      </div>
    `;
  }

  html += "</div>";

  html += "<h3>📊 Estimated Totals</h3>";
  html += '<div class="nutrition-grid">';
  const totalEntries = Object.entries(totals);

  if (totalEntries.length) {
    totalEntries.forEach(([label, value]) => {
      html += `
        <div class="nutrition-card">
          <div class="val">${escapeHtml(String(value))}</div>
          <div class="lbl">${escapeHtml(label)}</div>
        </div>
      `;
    });
  } else {
    html += `
      <div class="nutrition-card">
        <div class="val">N/A</div>
        <div class="lbl">No totals returned</div>
      </div>
    `;
  }
  html += "</div>";

  if (goalMatch) {
    html += `<h3>🎯 Goal Match</h3><div class="goal-match">${escapeHtml(goalMatch)}</div>`;
  }

  if (tips.length) {
    html += "<h3>💡 Tips</h3>";
    html += '<div class="tips-list">';
    tips.forEach((tip) => {
      html += `<div class="tip">${escapeHtml(tip)}</div>`;
    });
    html += "</div>";
  }

  body.innerHTML = html;
  result.classList.add("visible");
}

function escapeHtml(str) {
  if (!str) return "";
  str = String(str);
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}