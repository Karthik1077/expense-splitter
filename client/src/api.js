// Central fetch wrapper. Reads the API base URL from an env var so the
// same build works locally and once deployed (set VITE_API_URL on Vercel).
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // No JSON body (e.g. some error responses) — leave data as null.
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  signup: (body) => request("/auth/signup", { method: "POST", body }),
  login: (body) => request("/auth/login", { method: "POST", body }),

  listGroups: (token) => request("/groups", { token }),
  createGroup: (body, token) => request("/groups", { method: "POST", body, token }),
  getGroup: (id, token) => request(`/groups/${id}`, { token }),
  addMember: (id, body, token) =>
    request(`/groups/${id}/members`, { method: "POST", body, token }),
  getBalances: (id, token) => request(`/groups/${id}/balances`, { token }),

  addExpense: (groupId, body, token) =>
    request(`/groups/${groupId}/expenses`, { method: "POST", body, token }),
  deleteExpense: (groupId, expenseId, token) =>
    request(`/groups/${groupId}/expenses/${expenseId}`, { method: "DELETE", token }),

  getSpendingByCategory: (groupId, token) =>
    request(`/groups/${groupId}/spending-by-category`, { token }),

  recordSettlement: (groupId, body, token) =>
    request(`/groups/${groupId}/settlements`, { method: "POST", body, token }),
  getSettlementHistory: (groupId, token) =>
    request(`/groups/${groupId}/settlements`, { token }),

  sendInvite: (groupId, body, token) =>
    request(`/groups/${groupId}/invites`, { method: "POST", body, token }),
  listInvites: (groupId, token) => request(`/groups/${groupId}/invites`, { token }),
};
