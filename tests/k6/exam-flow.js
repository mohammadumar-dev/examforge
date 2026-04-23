/**
 * HI Tech Examination k6 Load Test — Full Student Exam Journey
 *
 * Scenarios (select via SCENARIO env var):
 *   smoke  — 5 VUs, 2 min   (verify nothing is broken)
 *   load   — ramp to 500 VUs, hold 15 min (baseline capacity)
 *   stress — ramp to 5000 VUs, hold 90 min (full exam simulation)
 *   spike  — 5000 VUs instant submit (worst-case timer expiry)
 *
 * Usage:
 *   SCENARIO=smoke EXAM_SLUG=load-test-exam k6 run tests/k6/exam-flow.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { SharedArray } from "k6/data";

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL   = __ENV.BASE_URL   || "http://localhost:3000";
const EXAM_SLUG  = __ENV.EXAM_SLUG  || "load-test-exam";
const SCENARIO   = __ENV.SCENARIO   || "load";

// Unique per k6 run — prevents rate-limit collisions across re-runs
// Each VU gets a different IP from a fresh /16 block
const RUN_OCTET = Math.floor(Math.random() * 200) + 10; // e.g. 123.x.x.x

// ─── Custom Metrics ───────────────────────────────────────────────────────────

const registrationErrors = new Rate("registration_errors");
const sessionErrors       = new Rate("session_errors");
const responseErrors      = new Rate("response_save_errors");
const submitErrors        = new Rate("submit_errors");
const scoringLatency      = new Trend("scoring_latency_ms", true);
const submissionsTotal    = new Counter("submissions_total");

// ─── Scenario Definitions ─────────────────────────────────────────────────────

const SCENARIOS = {
  smoke: {
    executor: "constant-vus",
    vus: 5,
    duration: "2m",
  },
  // 10 VU sanity check — verify full flow before scaling
  "10": {
    executor: "constant-vus",
    vus: 10,
    duration: "5m",
  },
  // 100 VU baseline — first step before scaling up
  "100": {
    executor: "ramping-vus",
    stages: [
      { duration: "2m", target: 100 },
      { duration: "8m", target: 100 },
      { duration: "2m", target: 0   },
    ],
  },
  // 500 VU medium load
  "500": {
    executor: "ramping-vus",
    stages: [
      { duration: "2m", target: 100 },
      { duration: "3m", target: 500 },
      { duration: "8m", target: 500 },
      { duration: "2m", target: 0   },
    ],
  },
  load: {
    executor: "ramping-vus",
    stages: [
      { duration: "2m", target: 100  },
      { duration: "5m", target: 500  },
      { duration: "15m", target: 500 },
      { duration: "3m", target: 0   },
    ],
  },
  // 2000 concurrent students — realistic large-exam simulation
  "2k": {
    executor: "ramping-vus",
    stages: [
      { duration: "3m",  target: 500  },
      { duration: "5m",  target: 2000 },
      { duration: "20m", target: 2000 },
      { duration: "3m",  target: 0    },
    ],
  },
  stress: {
    executor: "ramping-vus",
    stages: [
      { duration: "5m",  target: 1000 },
      { duration: "10m", target: 5000 },
      { duration: "90m", target: 5000 },
      { duration: "5m",  target: 0   },
    ],
  },
  // Simulates 5000 students hitting submit simultaneously (timer expiry)
  spike: {
    executor: "ramping-arrival-rate",
    startRate: 0,
    timeUnit: "1s",
    preAllocatedVUs: 5000,
    maxVUs: 6000,
    stages: [
      { duration: "30s", target: 5000 },
      { duration: "5m",  target: 5000 },
      { duration: "30s", target: 0   },
    ],
  },
};

export const options = {
  scenarios: {
    exam: SCENARIOS[SCENARIO] || SCENARIOS.load,
  },
  thresholds: {
    http_req_duration:     ["p(95)<2000", "p(99)<5000"],
    http_req_failed:       ["rate<0.02"],         // <2% overall HTTP errors
    registration_errors:   ["rate<0.01"],
    session_errors:        ["rate<0.01"],
    response_save_errors:  ["rate<0.02"],
    submit_errors:         ["rate<0.01"],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function headers(extra = {}) {
  return {
    "Content-Type": "application/json",
    // Unique IP per VU + per run — prevents rate-limit collisions across re-runs
    "X-Forwarded-For": `${RUN_OCTET}.${Math.floor(__VU / 65025) % 255}.${Math.floor(__VU / 255) % 255}.${__VU % 255}`,
    ...extra,
  };
}

function post(path, body, hdrs = {}) {
  return http.post(`${BASE_URL}${path}`, JSON.stringify(body), {
    headers: headers(hdrs),
    timeout: "15s",
  });
}

function get(path, hdrs = {}) {
  return http.get(`${BASE_URL}${path}`, {
    headers: headers(hdrs),
    timeout: "15s",
  });
}

function randomPhone() {
  return `+919${String(Math.floor(Math.random() * 900000000) + 100000000)}`;
}

// ─── Main VU Function ─────────────────────────────────────────────────────────

export default function () {
  const vuId    = __VU;
  const iter    = __ITER;
  const email   = `student_${vuId}_${iter}_${Date.now()}@loadtest.local`;
  const name    = `Student ${vuId}-${iter}`;
  const phone   = randomPhone();

  // ── Step 1: Register ────────────────────────────────────────────────────────
  const regRes = post(`/api/exam/${EXAM_SLUG}/register`, {
    email,
    name,
    mobileNumber: phone,
    whatsappNumber: phone,
  });

  const regOk = check(regRes, {
    "register 200":           (r) => r.status === 200,
    "register returns token": (r) => r.json("examPassword") !== undefined,
  });
  registrationErrors.add(!regOk);
  if (!regOk) {
    console.error(`[VU${vuId}] Register failed: ${regRes.status} ${regRes.body}`);
    sleep(2);
    return;
  }

  const examPassword = regRes.json("examPassword");
  sleep(0.5);

  // ── Step 2: Start Session ───────────────────────────────────────────────────
  const sessionRes = post(`/api/exam/${EXAM_SLUG}/verify-access`, {
    email,
    password: examPassword,
  });

  const sessionOk = check(sessionRes, {
    "verify-access 200":            (r) => r.status === 200,
    "verify-access returns token":  (r) => r.json("sessionToken") !== undefined,
  });
  sessionErrors.add(!sessionOk);
  if (!sessionOk) {
    console.error(`[VU${vuId}] Verify-access failed: ${sessionRes.status} ${sessionRes.body}`);
    return;
  }

  const sessionToken = sessionRes.json("sessionToken");
  const sessionId    = sessionRes.json("sessionId");
  const sessionHdr   = { "x-session-token": sessionToken };
  sleep(1);

  // ── Step 3: Load Questions ──────────────────────────────────────────────────
  const qRes = get(`/api/exam/${EXAM_SLUG}/questions`, sessionHdr);

  const qOk = check(qRes, {
    "questions 200":       (r) => r.status === 200,
    "questions non-empty": (r) => (r.json("questions") || []).length > 0,
  });
  if (!qOk) {
    console.error(`[VU${vuId}] Questions failed: ${qRes.status}`);
    return;
  }

  const questions = qRes.json("questions") || [];
  sleep(2);

  // ── Step 4: Answer Questions ────────────────────────────────────────────────
  for (const q of questions) {
    const options = q.options || [];
    if (options.length === 0) continue;

    // Pick a random option (not always the first — more realistic)
    const chosen = options[Math.floor(Math.random() * options.length)];

    const ansRes = post(`/api/exam/${EXAM_SLUG}/response`, {
      questionId: q.id,
      optionIds:  [chosen.id],
      isSkipped:  false,
    }, sessionHdr);

    check(ansRes, { "response saved": (r) => r.status === 200 });
    responseErrors.add(ansRes.status !== 200);

    // Realistic think time between answers (2–8 seconds per question)
    sleep(Math.random() * 6 + 2);
  }

  // ── Step 5: Submit ──────────────────────────────────────────────────────────
  const submitRes = post(`/api/exam/${EXAM_SLUG}/submit`, {}, sessionHdr);

  const submitOk = check(submitRes, {
    "submit 200":     (r) => r.status === 200,
    "submit accepted":(r) => r.json("submitted") === true,
  });
  submitErrors.add(!submitOk);
  if (!submitOk) {
    console.error(`[VU${vuId}] Submit failed: ${submitRes.status} ${submitRes.body}`);
    return;
  }
  submissionsTotal.add(1);

  // ── Step 6: Poll for Result ─────────────────────────────────────────────────
  const tStart = Date.now();
  let resultReady = false;

  for (let attempt = 0; attempt < 10; attempt++) {
    sleep(2);
    const resultRes = get(`/api/exam/${EXAM_SLUG}/result/${sessionId}`);

    if (resultRes.status === 200) {
      const body = resultRes.json();
      if (!body.scorePending && body.result) {
        resultReady = true;
        scoringLatency.add(Date.now() - tStart);
        check(resultRes, {
          "result has score":    () => body.result.score !== null,
          "result has isPassed": () => body.result.isPassed !== null,
        });
        break;
      }
    }
  }

  if (!resultReady) {
    console.warn(`[VU${vuId}] Result not ready after 20s for session ${sessionId}`);
  }
}
