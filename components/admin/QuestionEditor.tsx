"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, GripVertical, Check } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Option {
  id?: string;
  optionText: string;
  isCorrect: boolean;
  orderIndex: number;
}

interface Question {
  id: string;
  questionText: string;
  questionType: string;
  marks: number;
  orderIndex: number;
  explanation?: string;
  options: (Option & { id: string })[];
}

interface QuestionEditorProps {
  examId: string;
  questions: Question[];
  onUpdate: (questions: Question[]) => void;
}

function SortableQuestion({
  question,
  examId,
  onDelete,
  onSaved,
}: {
  question: Question;
  examId: string;
  onDelete: (id: string) => void;
  onSaved: (q: Question) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: question.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(question.questionText);
  const [marks, setMarks] = useState(String(question.marks));
  const [type, setType] = useState(question.questionType);
  const [explanation, setExplanation] = useState(question.explanation ?? "");
  const [options, setOptions] = useState<Option[]>(question.options);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addOption() {
    setOptions((o) => [
      ...o,
      { optionText: "", isCorrect: false, orderIndex: o.length },
    ]);
  }

  function removeOption(i: number) {
    setOptions((o) => o.filter((_, idx) => idx !== i).map((opt, idx) => ({ ...opt, orderIndex: idx })));
  }

  function toggleCorrect(i: number) {
    setOptions((o) =>
      o.map((opt, idx) => {
        if (type === "single_choice") {
          return { ...opt, isCorrect: idx === i };
        }
        return idx === i ? { ...opt, isCorrect: !opt.isCorrect } : opt;
      })
    );
  }

  async function handleSave() {
    setError("");
    setSaving(true);
    const res = await apiFetch(`/api/admin/exams/${examId}/questions/${question.id}`, {
      method: "PATCH",
      json: {
        questionText: text,
        marks: Number(marks),
        questionType: type,
        explanation: explanation || undefined,
        options: options.map((o, i) => ({ ...o, orderIndex: i })),
      },
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Save failed");
    } else {
      onSaved(data.question);
      setEditing(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this question?")) return;
    const res = await apiFetch(`/api/admin/exams/${examId}/questions/${question.id}`, {
      method: "DELETE",
    });
    if (res.ok) onDelete(question.id);
  }

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg bg-card">
      <div className="flex items-start gap-3 p-4">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab text-muted-foreground hover:text-foreground"
        >
          <GripVertical size={16} />
        </button>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-3">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Question text"
                rows={2}
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full text-sm border rounded-md px-2 py-1"
                  >
                    <option value="single_choice">Single Choice</option>
                    <option value="multiple_choice">Multiple Choice</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Marks</Label>
                  <Input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={marks}
                    onChange={(e) => setMarks(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Options (click ✓ to mark correct)</Label>
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCorrect(i)}
                      className={`shrink-0 w-6 h-6 rounded border flex items-center justify-center ${
                        opt.isCorrect
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-input"
                      }`}
                    >
                      {opt.isCorrect && <Check size={12} />}
                    </button>
                    <Input
                      value={opt.optionText}
                      onChange={(e) =>
                        setOptions((o) =>
                          o.map((x, idx) =>
                            idx === i ? { ...x, optionText: e.target.value } : x
                          )
                        )
                      }
                      placeholder={`Option ${i + 1}`}
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" onClick={addOption}>
                  <Plus size={12} className="mr-1" /> Add Option
                </Button>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Explanation (shown after exam if review enabled)</Label>
                <Input
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Optional explanation"
                />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="font-medium text-sm">{question.questionText}</p>
              <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                <span>{question.questionType === "single_choice" ? "Single" : "Multiple"} choice</span>
                <span>{question.marks} mark{Number(question.marks) !== 1 ? "s" : ""}</span>
                <span>{question.options.length} options</span>
              </div>
            </div>
          )}
        </div>

        {!editing && (
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={handleDelete}>
              <Trash2 size={14} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface AddQuestionFormProps {
  examId: string;
  onAdded: (q: Question) => void;
}

function AddQuestionForm({ examId, onAdded }: AddQuestionFormProps) {
  const [text, setText] = useState("");
  const [marks, setMarks] = useState("1");
  const [type, setType] = useState("single_choice");
  const [options, setOptions] = useState<Option[]>([
    { optionText: "", isCorrect: false, orderIndex: 0 },
    { optionText: "", isCorrect: false, orderIndex: 1 },
    { optionText: "", isCorrect: false, orderIndex: 2 },
    { optionText: "", isCorrect: false, orderIndex: 3 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleCorrect(i: number) {
    setOptions((o) =>
      o.map((opt, idx) =>
        type === "single_choice"
          ? { ...opt, isCorrect: idx === i }
          : idx === i
          ? { ...opt, isCorrect: !opt.isCorrect }
          : opt
      )
    );
  }

  async function handleAdd() {
    setError("");
    const validOptions = options.filter((o) => o.optionText.trim());
    if (!text.trim()) { setError("Question text is required"); return; }
    if (validOptions.length < 2) { setError("At least 2 options required"); return; }
    if (!validOptions.some((o) => o.isCorrect)) { setError("Mark at least one correct option"); return; }

    setSaving(true);
    const res = await apiFetch(`/api/admin/exams/${examId}/questions`, {
      method: "POST",
      json: {
        questionText: text,
        questionType: type,
        marks: Number(marks),
        options: validOptions.map((o, i) => ({ ...o, orderIndex: i })),
      },
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to add");
    } else {
      onAdded(data.question);
      setText("");
      setOptions([
        { optionText: "", isCorrect: false, orderIndex: 0 },
        { optionText: "", isCorrect: false, orderIndex: 1 },
        { optionText: "", isCorrect: false, orderIndex: 2 },
        { optionText: "", isCorrect: false, orderIndex: 3 },
      ]);
    }
  }

  return (
    <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
      <h3 className="font-semibold text-sm">Add Question</h3>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter question text…"
        rows={2}
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full text-sm border rounded-md px-2 py-1 bg-background"
          >
            <option value="single_choice">Single Choice</option>
            <option value="multiple_choice">Multiple Choice</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Marks</Label>
          <Input type="number" min={0.5} step={0.5} value={marks} onChange={(e) => setMarks(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Options (click ✓ to mark correct)</Label>
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleCorrect(i)}
              className={`shrink-0 w-6 h-6 rounded border flex items-center justify-center ${
                opt.isCorrect ? "bg-green-500 border-green-500 text-white" : "border-input bg-background"
              }`}
            >
              {opt.isCorrect && <Check size={12} />}
            </button>
            <Input
              value={opt.optionText}
              onChange={(e) =>
                setOptions((o) => o.map((x, idx) => (idx === i ? { ...x, optionText: e.target.value } : x)))
              }
              placeholder={`Option ${i + 1}`}
            />
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button size="sm" onClick={handleAdd} disabled={saving}>
        {saving ? "Adding…" : "Add Question"}
      </Button>
    </div>
  );
}

export function QuestionEditor({ examId, questions: initialQ, onUpdate }: QuestionEditorProps) {
  const [questions, setQuestions] = useState<Question[]>(initialQ);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    const reordered = arrayMove(questions, oldIndex, newIndex);
    setQuestions(reordered);
    onUpdate(reordered);

    await apiFetch(`/api/admin/exams/${examId}/questions/reorder`, {
      method: "PATCH",
      json: { questionIds: reordered.map((q) => q.id) },
    });
  }

  return (
    <div className="space-y-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {questions.map((q) => (
              <SortableQuestion
                key={q.id}
                question={q}
                examId={examId}
                onDelete={(id) => {
                  const updated = questions.filter((x) => x.id !== id);
                  setQuestions(updated);
                  onUpdate(updated);
                }}
                onSaved={(updated) => {
                  const list = questions.map((x) => (x.id === updated.id ? updated : x));
                  setQuestions(list);
                  onUpdate(list);
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {questions.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          No questions yet. Add your first question below.
        </p>
      )}

      <AddQuestionForm
        examId={examId}
        onAdded={(q) => {
          const updated = [...questions, q];
          setQuestions(updated);
          onUpdate(updated);
        }}
      />
    </div>
  );
}
