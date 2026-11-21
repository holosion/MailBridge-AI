// Validates model output and GROUNDS claims in the email text, so deadlines/actions cannot be fabricated.
export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export interface ValidatedSummary {
  mainMessage: string; requiredAction: string | null; deadlineText: string | null; deadlineEvidence: string | null;
  priority: Priority; priorityReason: string; warnings: string[];
}
export class SummaryValidationError extends Error {}

const norm = (s: string) => s.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\s+/g, " ").trim();
export function evidenceInText(evidence: unknown, text: string): boolean {
  return typeof evidence === "string" && norm(evidence).length >= 4 && norm(text).includes(norm(evidence));
}
export function parseModelJson(raw: string): unknown {
  const t = raw.replace(/```(?:json)?/gi, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw new SummaryValidationError("No JSON object in model output");
  try { return JSON.parse(t.slice(a, b + 1)); } catch { throw new SummaryValidationError("Model output was not valid JSON"); }
}
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export function validateSummary(raw: unknown, emailText: string): ValidatedSummary {
  if (!raw || typeof raw !== "object") throw new SummaryValidationError("Summary is not an object");
  const r = raw as Record<string, any>;
  const warnings: string[] = [];
  const mainMessage = str(r.mainMessage, 600);
  if (!mainMessage) throw new SummaryValidationError("mainMessage missing");
  const priority = String(r.priority ?? "").toUpperCase() as Priority;
  if (!["LOW", "NORMAL", "HIGH", "URGENT"].includes(priority)) throw new SummaryValidationError("priority invalid");
  const priorityReason = str(r.priorityReason, 200);
  if (!priorityReason) throw new SummaryValidationError("priorityReason missing");

  let requiredAction = str(r.requiredAction?.text ?? r.requiredAction, 300);
  const actionEvidence = r.requiredAction && typeof r.requiredAction === "object" ? r.requiredAction.evidence : r.requiredActionEvidence;
  if (requiredAction && !evidenceInText(actionEvidence, emailText)) { warnings.push("required action dropped: no supporting quote found in email"); requiredAction = null; }

  let deadlineText = str(r.deadline?.text, 120), deadlineEvidence = str(r.deadline?.evidence, 200);
  if (deadlineText && !evidenceInText(deadlineEvidence, emailText)) { warnings.push("deadline dropped: no supporting quote found in email"); deadlineText = deadlineEvidence = null; }
  if (!deadlineText) deadlineEvidence = null;
  return { mainMessage, requiredAction, deadlineText, deadlineEvidence, priority, priorityReason, warnings };
}
