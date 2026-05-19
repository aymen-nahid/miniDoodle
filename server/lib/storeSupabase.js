import { SLOT_DEFS } from "./slots.js";
import { getSupabaseClient } from "./supabase.js";

let supabase;

export async function initStore() {
  supabase = getSupabaseClient();
  // Light connectivity check
  const { error } = await supabase.from("votes").select("slot_id").limit(1);
  if (error) throw new Error(`Supabase error: ${error.message}`);
}

export function listSlots() {
  return SLOT_DEFS.map(({ id, label, starts_at, ends_at }) => ({ id, label, starts_at, ends_at }));
}

export async function getVotesByPerson(personName) {
  const { data, error } = await supabase
    .from("votes")
    .select("slot_id, vote")
    .eq("person_name", personName);
  if (error) throw new Error(error.message);
  const map = {};
  for (const r of data || []) map[r.slot_id] = Boolean(r.vote);
  return map;
}

export async function upsertVotes(personName, votesMap) {
  const slotIds = new Set(listSlots().map((s) => s.id));
  const rows = [];
  for (const [slotId, vote] of Object.entries(votesMap)) {
    if (!slotIds.has(slotId)) continue;
    rows.push({ person_name: personName, slot_id: slotId, vote: Boolean(vote) });
  }

  if (rows.length === 0) return { updated: 0 };

  const { error } = await supabase.from("votes").upsert(rows, { onConflict: "person_name,slot_id" });
  if (error) throw new Error(error.message);
  return { updated: rows.length };
}

export async function getSummary() {
  const slots = listSlots();
  const slotIds = slots.map((s) => s.id);

  const { data, error } = await supabase.from("votes").select("person_name, slot_id, vote");
  if (error) throw new Error(error.message);

  const byPerson = new Map();
  for (const row of data || []) {
    const name = row.person_name;
    if (!byPerson.has(name)) byPerson.set(name, {});
    byPerson.get(name)[row.slot_id] = Boolean(row.vote);
  }

  const people = Array.from(byPerson.keys()).sort((a, b) => a.localeCompare(b, "fr"));
  const rows = people.map((name) => {
    const votes = byPerson.get(name) || {};
    const normalized = {};
    for (const id of slotIds) normalized[id] = Boolean(votes[id]);
    return { name, votes: normalized };
  });

  const totals = {};
  for (const id of slotIds) totals[id] = 0;
  for (const row of rows) {
    for (const [slotId, vote] of Object.entries(row.votes)) if (vote) totals[slotId] += 1;
  }

  const maxVotes = Math.max(0, ...Object.values(totals));
  const bestSlotIds = slotIds.filter((id) => totals[id] === maxVotes && maxVotes > 0);

  return { slots, rows, totals, bestSlotIds, maxVotes };
}

