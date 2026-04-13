const APP_NAME = "ExamForge";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function baseLayout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${APP_NAME}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; margin: 0; padding: 24px; }
    .card { background: #fff; border-radius: 8px; max-width: 520px; margin: 0 auto; padding: 40px 36px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    h1 { color: #18181b; font-size: 22px; margin: 0 0 8px; }
    p { color: #52525b; font-size: 15px; line-height: 1.6; margin: 12px 0; }
    .btn { display: inline-block; background: #18181b; color: #fff !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; margin: 20px 0; }
    .footer { color: #a1a1aa; font-size: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e4e4e7; }
    .code { background: #f4f4f5; border-radius: 4px; padding: 2px 6px; font-family: monospace; color: #18181b; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🔐 ${APP_NAME}</h1>
    ${content}
    <div class="footer">
      <p>This email was sent by ${APP_NAME}. If you didn't request this, you can safely ignore it.</p>
    </div>
  </div>
</body>
</html>`;
}

export function verificationEmail(name: string, verifyLink: string): string {
  return baseLayout(`
    <p>Hi <strong>${name}</strong>,</p>
    <p>You've been registered as an admin on ${APP_NAME}. Click the button below to verify your email and activate your account.</p>
    <a href="${verifyLink}" class="btn">Verify Email</a>
    <p>Or copy this link: <span class="code">${verifyLink}</span></p>
    <p>This link expires in <strong>24 hours</strong>.</p>
  `);
}

export function passwordResetEmail(name: string, resetLink: string): string {
  return baseLayout(`
    <p>Hi <strong>${name}</strong>,</p>
    <p>We received a request to reset your ${APP_NAME} admin password. Click the button below to set a new password.</p>
    <a href="${resetLink}" class="btn">Reset Password</a>
    <p>Or copy this link: <span class="code">${resetLink}</span></p>
    <p>This link expires in <strong>1 hour</strong>. If you didn't request a password reset, no action is needed.</p>
  `);
}

export function examInviteEmail(
  studentEmail: string,
  examTitle: string,
  examLink: string,
  instructions?: string
): string {
  return baseLayout(`
    <p>Hi,</p>
    <p>You've been invited to take the exam: <strong>${examTitle}</strong>.</p>
    ${instructions ? `<p><strong>Instructions:</strong> ${instructions}</p>` : ""}
    <a href="${examLink}" class="btn">Start Exam</a>
    <p>Or copy this link: <span class="code">${examLink}</span></p>
    <p>You'll need to enter your Gmail address (<span class="code">${studentEmail}</span>) to access the exam.</p>
  `);
}

export function examResultEmail(
  studentEmail: string,
  examTitle: string,
  score: number,
  totalMarks: number,
  percentage: number,
  isPassed: boolean,
  timeTakenSeconds?: number
): string {
  const timeStr = timeTakenSeconds
    ? `${Math.floor(timeTakenSeconds / 60)}m ${timeTakenSeconds % 60}s`
    : "N/A";

  return baseLayout(`
    <p>Hi,</p>
    <p>Thank you for completing <strong>${examTitle}</strong>. Here are your results:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#71717a;">Score</td><td style="padding:8px 0;font-weight:600;">${score} / ${totalMarks}</td></tr>
      <tr><td style="padding:8px 0;color:#71717a;">Percentage</td><td style="padding:8px 0;font-weight:600;">${percentage.toFixed(1)}%</td></tr>
      <tr><td style="padding:8px 0;color:#71717a;">Result</td><td style="padding:8px 0;font-weight:600;color:${isPassed ? "#16a34a" : "#dc2626"};">${isPassed ? "✅ PASSED" : "❌ FAILED"}</td></tr>
      <tr><td style="padding:8px 0;color:#71717a;">Time Taken</td><td style="padding:8px 0;">${timeStr}</td></tr>
    </table>
  `);
}

export function newSubmissionEmail(
  adminName: string,
  studentEmail: string,
  examTitle: string,
  score: number,
  totalMarks: number,
  percentage: number,
  submissionsLink: string
): string {
  return baseLayout(`
    <p>Hi <strong>${adminName}</strong>,</p>
    <p>A new submission has been received for <strong>${examTitle}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#71717a;">Student</td><td style="padding:8px 0;">${studentEmail}</td></tr>
      <tr><td style="padding:8px 0;color:#71717a;">Score</td><td style="padding:8px 0;font-weight:600;">${score} / ${totalMarks} (${percentage.toFixed(1)}%)</td></tr>
    </table>
    <a href="${submissionsLink}" class="btn">View Submissions</a>
  `);
}
