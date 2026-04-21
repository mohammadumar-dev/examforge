"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";

interface Option {
  id: string;
  optionText: string;
}

interface Question {
  id: string;
  questionText: string;
  questionType: string;
  marks: number;
  orderIndex: number;
  options: Option[];
}

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  savedOptionIds: string[];
  onAnswer: (questionId: string, optionIds: string[]) => void;
  onNext: () => void;
  onPrev: () => void;
  onSubmit: () => void;
  isLast: boolean;
  isFirst: boolean;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  savedOptionIds,
  onAnswer,
  onNext,
  onPrev,
  onSubmit,
  isLast,
  isFirst,
}: QuestionCardProps) {
  const [selected, setSelected] = useState<string[]>(savedOptionIds);

  useEffect(() => {
    setSelected(savedOptionIds);
  }, [question.id, savedOptionIds.join(",")]);

  function toggleOption(optionId: string) {
    let next: string[];
    if (question.questionType === "single_choice") {
      next = selected.includes(optionId) ? [] : [optionId];
    } else {
      next = selected.includes(optionId)
        ? selected.filter((id) => id !== optionId)
        : [...selected, optionId];
    }
    setSelected(next);
    onAnswer(question.id, next);
  }

  const progressPercent = (questionNumber / totalQuestions) * 100;

  return (
    <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 sm:px-6 py-6">
      {/* Progress section */}
      <div className="mb-5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            Question {questionNumber} of {totalQuestions}
          </span>
          <span className="text-sm font-semibold text-primary">
            {Math.round(progressPercent)}%
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Question box */}
      <div className="bg-card border rounded-xl p-6 space-y-5 flex-1">
        <div className="space-y-3">
          {/* Marks badge */}
          <div>
            <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full">
              {question.marks} mark{Number(question.marks) !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Question text */}
          <p className="text-base sm:text-lg font-medium leading-relaxed">
            {question.questionText}
          </p>

          {/* Multiple choice tag */}
          {question.questionType === "multiple_choice" && (
            <span className="inline-flex items-center bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-1 rounded-full border border-amber-200">
              Select all that apply
            </span>
          )}
        </div>

        {/* Options */}
        <div className="space-y-3">
          {question.options.map((option, index) => {
            const isSelected = selected.includes(option.id);
            const isRadio = question.questionType === "single_choice";
            const label = String.fromCharCode(65 + index); // A, B, C, D …

            return (
              <button
                key={option.id}
                onClick={() => toggleOption(option.id)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  isSelected
                    ? "border-primary bg-primary/8 ring-1 ring-primary/30"
                    : "border-border bg-background hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                {/* Option letter label */}
                <div
                  className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-muted text-muted-foreground"
                  }`}
                >
                  {isSelected ? <Check size={11} strokeWidth={3} /> : label}
                </div>
                <span className="text-sm leading-relaxed">{option.optionText}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation — sticky bottom */}
      <div className="border-t bg-background/80 backdrop-blur-sm px-0 py-4 flex items-center justify-between mt-4">
        <Button variant="outline" onClick={onPrev} disabled={isFirst} size="sm">
          <ArrowLeft size={14} />
          Previous
        </Button>

        {isLast ? (
          <Button onClick={onSubmit} size="sm">
            <CheckCircle size={14} />
            Review & Submit
          </Button>
        ) : (
          <Button onClick={onNext} size="sm">
            Next
            <ArrowRight size={14} />
          </Button>
        )}
      </div>
    </div>
  );
}
