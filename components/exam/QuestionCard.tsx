"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

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

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 py-6 space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Question {questionNumber} of {totalQuestions}</span>
        <span>{question.marks} mark{Number(question.marks) !== 1 ? "s" : ""}</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div
          className="bg-primary h-1.5 rounded-full transition-all"
          style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="space-y-4">
        <p className="text-lg font-medium leading-relaxed">{question.questionText}</p>
        {question.questionType === "multiple_choice" && (
          <p className="text-xs text-muted-foreground">Select all that apply</p>
        )}
      </div>

      {/* Options */}
      <div className="space-y-3">
        {question.options.map((option) => {
          const isSelected = selected.includes(option.id);
          return (
            <button
              key={option.id}
              onClick={() => toggleOption(option.id)}
              className={`w-full text-left p-4 rounded-lg border transition-all flex items-center gap-3 ${
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-accent/50"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-${question.questionType === "single_choice" ? "full" : "sm"} border-2 flex items-center justify-center shrink-0 ${
                  isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                }`}
              >
                {isSelected && <Check size={12} />}
              </div>
              <span className="text-sm">{option.optionText}</span>
            </button>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t mt-auto">
        <Button variant="outline" onClick={onPrev} disabled={isFirst}>
          ← Previous
        </Button>

        {isLast ? (
          <Button onClick={onSubmit} variant="default">
            Review & Submit
          </Button>
        ) : (
          <Button onClick={onNext}>
            Next →
          </Button>
        )}
      </div>
    </div>
  );
}
