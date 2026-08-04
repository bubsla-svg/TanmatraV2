import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isRegNoRequired,
  regNoProblem,
  partnerLeadProblems,
  submitPartnerLead,
  REG_NO_PATTERN,
} from "./partnerLeadsApi";

const base = { kind: "gym" as const, name: "Iron Yard", email: "", workEmail: "ops@ironyard.example", rdRegNo: "" };

test("only rd and dietitian require a registration number", () => {
  assert.equal(isRegNoRequired("rd"), true);
  assert.equal(isRegNoRequired("dietitian"), true);
  assert.equal(isRegNoRequired("gym"), false);
  assert.equal(isRegNoRequired("trainer"), false);
  assert.equal(isRegNoRequired("fitness_club"), false);
});

test("a blank registration number is fine for a kind that does not need one", () => {
  assert.equal(regNoProblem("gym", ""), null);
  assert.equal(regNoProblem("trainer", "   "), null);
});

test("a blank registration number is rejected for rd and dietitian", () => {
  assert.ok(regNoProblem("rd", ""));
  assert.ok(regNoProblem("dietitian", "   "));
});

test("registration numbers matching the server pattern are accepted", () => {
  assert.equal(regNoProblem("rd", "RD-1234"), null);
  assert.equal(regNoProblem("rd", "IDA/5678"), null);
  assert.equal(regNoProblem("dietitian", "RD DEL 2018.42"), null);
});

test("a 3-character value is rejected even though the pattern allows it", () => {
  // The route applies BOTH a length >= 4 check and the pattern; the pattern
  // alone matches 3 characters, so the length guard has to be enforced too.
  assert.match("RD1", REG_NO_PATTERN);
  assert.ok(regNoProblem("rd", "RD1"));
  assert.equal(regNoProblem("rd", "RD12"), null);
});

test("registration numbers are rejected past 31 characters", () => {
  assert.equal(regNoProblem("rd", "A".repeat(31)), null);
  assert.ok(regNoProblem("rd", "A".repeat(32)));
});

test("a registration number cannot start with a separator", () => {
  assert.ok(regNoProblem("rd", "/RD1234"));
  assert.ok(regNoProblem("rd", "-RD1234"));
  assert.ok(regNoProblem("rd", ".RD1234"));
});

test("surrounding whitespace is trimmed, not rejected — as the server does", () => {
  // The route declares z.string().trim(), so the refine never sees the padding.
  // Matching that here keeps the form from rejecting a paste the server accepts.
  assert.equal(regNoProblem("rd", "  RD1234  "), null);
});

test("a registration number rejects characters outside the allowed set", () => {
  assert.ok(regNoProblem("rd", "RD#1234"));
  assert.ok(regNoProblem("rd", "RD_1234"));
});

test("either email or workEmail satisfies the requirement", () => {
  assert.equal(partnerLeadProblems({ ...base, email: "", workEmail: "a@b.co" }).email, undefined);
  assert.equal(partnerLeadProblems({ ...base, email: "a@b.co", workEmail: "" }).email, undefined);
});

test("neither email present is reported on the email field, as the server does", () => {
  const p = partnerLeadProblems({ ...base, email: "", workEmail: "" });
  assert.ok(p.email);
});

test("a malformed address is reported on whichever field carries it", () => {
  assert.ok(partnerLeadProblems({ ...base, email: "not-an-email", workEmail: "" }).email);
  assert.ok(partnerLeadProblems({ ...base, email: "", workEmail: "nope@" }).workEmail);
});

test("a short name is rejected and a valid gym lead is clean", () => {
  assert.ok(partnerLeadProblems({ ...base, name: "A" }).name);
  assert.deepEqual(partnerLeadProblems(base), {});
});

test("an rd lead is blocked until the registration number is valid", () => {
  const asRd = { ...base, kind: "rd" as const };
  assert.ok(partnerLeadProblems(asRd).rdRegNo);
  assert.deepEqual(partnerLeadProblems({ ...asRd, rdRegNo: "IDA/5678" }), {});
});

test("submitPartnerLead posts to /partners/leads with the given body", async () => {
  let seenUrl = "";
  let seenBody: unknown = null;
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    seenUrl = String(url);
    seenBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ ok: true, id: 7 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const result = await submitPartnerLead(
    { kind: "gym", name: "Iron Yard", workEmail: "ops@ironyard.example", source: "web:/partners/gyms" },
    fetchImpl as typeof fetch,
  );
  assert.match(seenUrl, /\/api\/partners\/leads$/);
  assert.deepEqual(seenBody, {
    kind: "gym",
    name: "Iron Yard",
    workEmail: "ops@ironyard.example",
    source: "web:/partners/gyms",
  });
  assert.equal(result.id, 7);
});
