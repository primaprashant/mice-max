/** The attendee's plans, client-side in the demo (the plan's trade-off:
 * the `plans` UI table lives in the browser, not in the database). */
export type PlanStatus = "saved" | "joined" | "booked";

export interface StoredPlan {
  kind: "event";
  ref_id: string;
  day: string;
  start: string;
  end: string;
  status: PlanStatus;
  party_size: number;
}

const KEY = "micemax_plans";

export function loadPlans(): StoredPlan[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as StoredPlan[];
  } catch {
    return [];
  }
}

export function savePlans(plans: StoredPlan[]) {
  localStorage.setItem(KEY, JSON.stringify(plans));
}

export function planFor(refId: string): StoredPlan | undefined {
  return loadPlans().find((p) => p.ref_id === refId);
}

export function putPlan(plan: StoredPlan) {
  const plans = loadPlans().filter((p) => p.ref_id !== plan.ref_id);
  plans.push(plan);
  savePlans(plans);
}

export function removePlan(refId: string) {
  savePlans(loadPlans().filter((p) => p.ref_id !== refId));
}
