import { describe, it, expect, beforeEach } from "vitest";
import { buildExamRegistrationTemplate } from "@/lib/whatsapp-templates";

const base = {
  studentName: "Rahul Sharma",
  examTitle: "UPSC Mock Test 1",
  examSlug: "upsc-mock-1",
  studentEmail: "rahul@example.com",
  examPassword: "AB12CD34",
  scheduledStartAt: null,
  timeLimitMinutes: 90,
};

describe("buildExamRegistrationTemplate", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://exam.example.com";
    process.env.NEXT_PUBLIC_ORG_NAME = "HI Tech Examination";
  });

  it("returns exactly 6 template variables", () => {
    const { templateVariables } = buildExamRegistrationTemplate(base);
    expect(templateVariables).toHaveLength(6);
  });

  it("maps variables in the documented order", () => {
    const { templateVariables } = buildExamRegistrationTemplate(base);
    expect(templateVariables[0]).toBe("Rahul Sharma");                           // {{1}} name
    expect(templateVariables[1]).toBe("UPSC Mock Test 1");                       // {{2}} title
    expect(templateVariables[2]).toBe("HI Tech Examination");                              // {{3}} org
    expect(templateVariables[3]).toContain("https://exam.example.com/exam/upsc-mock-1"); // {{4}} url
  });

  it('uses "As per schedule" for null start date', () => {
    const { templateVariables } = buildExamRegistrationTemplate(base);
    expect(templateVariables[4]).toBe("As per schedule");
  });

  it("passes timeLimitMinutes as a plain number string in {{6}}", () => {
    const { templateVariables } = buildExamRegistrationTemplate(base);
    expect(templateVariables[5]).toBe("90");
  });

  it('defaults {{6}} to "60" when timeLimitMinutes is null', () => {
    const { templateVariables } = buildExamRegistrationTemplate({ ...base, timeLimitMinutes: null });
    expect(templateVariables[5]).toBe("60");
  });

  it("formats scheduledStartAt as en-IN locale string", () => {
    const start = new Date("2026-04-18T10:00:00+05:30");
    const { templateVariables } = buildExamRegistrationTemplate({ ...base, scheduledStartAt: start });
    expect(templateVariables[4]).toBe(
      start.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    );
  });

  it("embeds email and password as query params in the exam URL", () => {
    const { templateVariables } = buildExamRegistrationTemplate(base);
    const url = new URL(templateVariables[3]);
    expect(url.pathname).toBe("/exam/upsc-mock-1");
    expect(url.searchParams.get("email")).toBe("rahul@example.com");
    expect(url.searchParams.get("pwd")).toBe("AB12CD34");
  });

  it("body contains the full exam URL with params", () => {
    const { body } = buildExamRegistrationTemplate(base);
    expect(body).toContain("https://exam.example.com/exam/upsc-mock-1");
  });

  it("body contains the org name", () => {
    const { body } = buildExamRegistrationTemplate(base);
    expect(body).toContain("HI Tech Examination");
  });

  it("body contains student name greeting", () => {
    const { body } = buildExamRegistrationTemplate(base);
    expect(body).toMatch(/Hi Rahul Sharma/);
  });

  it("body contains the approved template wording", () => {
    const { body } = buildExamRegistrationTemplate(base);
    expect(body).toContain("successfully received");
    expect(body).toContain("Scheduled Event Start Date");
  });

  it("strips trailing slash from NEXT_PUBLIC_APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://exam.example.com/";
    const { templateVariables } = buildExamRegistrationTemplate(base);
    expect(templateVariables[3]).toContain("https://exam.example.com/exam/upsc-mock-1");
    expect(templateVariables[3]).not.toContain("//exam/");
  });
});
