export function sanitizeName(input) {
  if (typeof input !== "string") return "";
  const normalized = input.trim().replace(/\s+/g, " ");
  if (normalized.length < 2) return "";
  if (normalized.length > 80) return normalized.slice(0, 80);
  return normalized;
}

export function validateVotesPayload(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid JSON body" };
  const { name, votes } = body;
  if (typeof name !== "string") return { ok: false, error: "name must be a string" };
  if (!votes || typeof votes !== "object") return { ok: false, error: "votes must be an object" };

  const outVotes = {};
  for (const [slotId, vote] of Object.entries(votes)) {
    if (typeof slotId !== "string") continue;
    if (typeof vote !== "boolean") return { ok: false, error: "Each vote must be boolean" };
    outVotes[slotId] = vote;
  }
  return { ok: true, value: { name, votes: outVotes } };
}

