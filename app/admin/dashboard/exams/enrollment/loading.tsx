import { Skeleton } from "@/components/ui/skeleton";

export default function EnrollmentLoading() {
  return (
    <div className="flex flex-col flex-1 p-6 gap-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-28 rounded" />
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-4 w-64 rounded" />
      </div>

      {/* Table card */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-3">
          <Skeleton className="size-8 rounded-lg shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-3 w-52 rounded" />
          </div>
        </div>
        <div className="p-5 space-y-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
