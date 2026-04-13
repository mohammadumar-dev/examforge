import { ExamForm } from "@/components/admin/ExamForm";

export default function NewExamPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create Exam</h1>
        <p className="text-sm text-muted-foreground mt-1">Set up your examination details</p>
      </div>
      <ExamForm mode="create" />
    </div>
  );
}
