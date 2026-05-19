const els = {
  name: document.querySelector("#name"),
  load: document.querySelector("#load"),
  save: document.querySelector("#save"),
  status: document.querySelector("#status"),
  slotsBody: document.querySelector("#slotsBody"),
  refresh: document.querySelector("#refresh"),
  bestSlot: document.querySelector("#bestSlot"),
  summaryHead: document.querySelector("#summaryHead"),
  summaryBody: document.querySelector("#summaryBody")
};

let slots = [];
let currentName = "";
let votes = {};

function setStatus(text, tone = "muted") {
  els.status.textContent = text;
  els.status.className = `status ${tone}`;
}

function sanitizeName(input) {
  return String(input || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function renderSlots() {
  els.slotsBody.innerHTML = "";
  for (const s of slots) {
    const tr = document.createElement("tr");
    const tdLabel = document.createElement("td");
    tdLabel.textContent = s.label;

    const tdVote = document.createElement("td");
    tdVote.className = "center";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = Boolean(votes[s.id]);
    cb.disabled = !currentName;
    cb.addEventListener("change", () => {
      votes[s.id] = cb.checked;
      els.save.disabled = !currentName;
      setStatus("Modifications non enregistrées.", "warn");
    });
    tdVote.appendChild(cb);

    tr.appendChild(tdLabel);
    tr.appendChild(tdVote);
    els.slotsBody.appendChild(tr);
  }
}

async function loadSlots() {
  const r = await fetch("/api/slots");
  const data = await r.json();
  slots = data.slots || [];
}

async function loadVotesForName(name) {
  const qs = new URLSearchParams({ name });
  const r = await fetch(`/api/votes?${qs.toString()}`);
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || "Erreur chargement");
  }
  const data = await r.json();
  votes = data.votes || {};
}

async function saveVotes() {
  const payload = { name: currentName, votes };
  const r = await fetch("/api/votes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || "Erreur enregistrement");
  }
  setStatus("Votes enregistrés.", "ok");
  await refreshSummary();
}

function escapeText(text) {
  return String(text ?? "");
}

function voteMark(value) {
  return value ? "✓" : "";
}

async function refreshSummary() {
  const r = await fetch("/api/summary", { cache: "no-store" });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || "Erreur récapitulatif");
  }
  const data = await r.json();
  const summarySlots = data.slots || [];
  const rows = data.rows || [];
  const totals = data.totals || {};
  const bestSlotIds = new Set(data.bestSlotIds || []);
  const maxVotes = Number(data.maxVotes || 0);

  // Head
  const headTr1 = document.createElement("tr");
  const thName = document.createElement("th");
  thName.textContent = "Nom";
  headTr1.appendChild(thName);

  for (const s of summarySlots) {
    const th = document.createElement("th");
    th.className = `center ${bestSlotIds.has(s.id) ? "best" : ""}`;
    th.title = s.label;
    th.textContent = s.label;
    headTr1.appendChild(th);
  }
  els.summaryHead.replaceChildren(headTr1);

  // Body rows
  els.summaryBody.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");
    const tdName = document.createElement("td");
    tdName.textContent = escapeText(row.name);
    tr.appendChild(tdName);
    for (const s of summarySlots) {
      const td = document.createElement("td");
      td.className = `center ${bestSlotIds.has(s.id) ? "bestCell" : ""}`;
      td.textContent = voteMark(Boolean(row.votes?.[s.id]));
      tr.appendChild(td);
    }
    els.summaryBody.appendChild(tr);
  }

  // Totals row
  const trTotal = document.createElement("tr");
  trTotal.className = "totals";
  const tdTotalLabel = document.createElement("td");
  tdTotalLabel.textContent = "Total";
  trTotal.appendChild(tdTotalLabel);
  for (const s of summarySlots) {
    const td = document.createElement("td");
    const total = Number(totals[s.id] || 0);
    td.className = `center ${bestSlotIds.has(s.id) ? "bestCell" : ""}`;
    td.textContent = String(total);
    trTotal.appendChild(td);
  }
  els.summaryBody.appendChild(trTotal);

  // Best slot text
  if (maxVotes <= 0 || summarySlots.length === 0) {
    els.bestSlot.textContent = "Meilleur créneau: —";
  } else {
    const bestLabels = summarySlots.filter((s) => bestSlotIds.has(s.id)).map((s) => s.label);
    els.bestSlot.textContent = `Meilleur créneau (${maxVotes} vote${maxVotes > 1 ? "s" : ""}): ${bestLabels.join(" / ")}`;
  }
}

els.load.addEventListener("click", async () => {
  const name = sanitizeName(els.name.value);
  if (name.length < 2) {
    setStatus("Entrez un nom et prénom (au moins 2 caractères).", "error");
    return;
  }
  try {
    els.load.disabled = true;
    setStatus("Chargement…");
    await loadVotesForName(name);
    currentName = name;
    els.save.disabled = false;
    setStatus(`Votes chargés pour ${currentName}.`, "ok");
    renderSlots();
  } catch (err) {
    setStatus(err.message || "Erreur", "error");
  } finally {
    els.load.disabled = false;
  }
});

els.save.addEventListener("click", async () => {
  if (!currentName) return;
  try {
    els.save.disabled = true;
    setStatus("Enregistrement…");
    await saveVotes();
  } catch (err) {
    setStatus(err.message || "Erreur", "error");
  } finally {
    els.save.disabled = false;
  }
});

els.refresh.addEventListener("click", async () => {
  try {
    els.refresh.disabled = true;
    setStatus("Actualisation…");
    await refreshSummary();
    setStatus("Récapitulatif à jour.", "ok");
  } finally {
    els.refresh.disabled = false;
  }
});

async function main() {
  await loadSlots();
  renderSlots();
  await refreshSummary();
}

main().catch(() => setStatus("Erreur initialisation.", "error"));
