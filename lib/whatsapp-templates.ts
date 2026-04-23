/**
 * Template: Exam_Registration_Confirmed
 *
 * Approved Meta template. Variable order must stay in sync with
 * deploy/whatsapp-templates/exam-registration-confirmed.txt
 *
 * {{1}} = Student Name
 * {{2}} = Exam Title
 * {{3}} = Organization name (e.g. "HI Tech Examination")
 * {{4}} = Full exam URL (e.g. https://yourdomain.com/exam/slug)
 * {{5}} = Scheduled Start Date/Time
 * {{6}} = Duration in minutes (number only, e.g. "90")
 */

export interface ExamRegistrationTemplateArgs {
  studentName: string;
  examTitle: string;
  examSlug: string;
  studentEmail: string;
  examPassword: string;
  scheduledStartAt: Date | string | null;
  timeLimitMinutes: number | null;
}

export function buildExamRegistrationTemplate(args: ExamRegistrationTemplateArgs): {
  body: string;
  templateVariables: string[];
} {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const params = new URLSearchParams({ email: args.studentEmail, pwd: args.examPassword });
  const examUrl = `${appUrl}/exam/${args.examSlug}?${params.toString()}`;
  const orgName = process.env.NEXT_PUBLIC_ORG_NAME ?? "HI Tech Examination";

  const start = args.scheduledStartAt
    ? new Date(args.scheduledStartAt).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      })
    : "As per schedule";

  const duration = args.timeLimitMinutes != null ? String(args.timeLimitMinutes) : "60";

  const templateVariables = [
    args.studentName, // {{1}}
    args.examTitle,   // {{2}}
    orgName,          // {{3}}
    examUrl,          // {{4}}
    start,            // {{5}}
    duration,         // {{6}}
  ];

  const body = [
    `Hi ${args.studentName},`,
    `We are pleased to inform you that your request for ${args.examTitle} from ${orgName} has been successfully received.`,
    ``,
    `To facilitate your session, we have created a dedicated Exam Link.`,
    `Please Click the link below to proceed with your request:`,
    examUrl,
    ``,
    `Scheduled Event Start Date - ${start} Duration ${duration} Minutes`,
    ``,
    `Thank you for using our service!`,
  ].join("\n");

  return { body, templateVariables };
}
