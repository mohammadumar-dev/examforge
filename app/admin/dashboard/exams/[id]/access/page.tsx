"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import { AccessControl } from "@/components/admin/AccessControl";
import { ArrowLeft } from "lucide-react";

export default function AccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [isPublished, setIsPublished] = useState(false);
  const [examTitle, setExamTitle] = useState("");

  useEffect(() => {
    apiFetch(`/api/admin/exams/${id}`)
      .then((r) => r.json())
      .then(({ exam }) => {
        setIsPublished(exam.isPublished);
        setExamTitle(exam.title);
      });
  }, [id]);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/dashboard/exams/${id}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Access Control</h1>
          {examTitle && <p className="text-sm text-muted-foreground">{examTitle}</p>}
        </div>
      </div>
      <AccessControl examId={id} isPublished={isPublished} />
    </div>
  );
}
