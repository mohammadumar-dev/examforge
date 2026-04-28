import { Skeleton } from "@/components/ui/skeleton";

export default function SharedEnrollmentLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex items-center gap-3">
        <Skeleton className="size-8 rounded-lg shrink-0" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-48 rounded" />
          <Skeleton className="h-3 w-36 rounded" />
        </div>
      </div>
      <div className="p-6">
        <div className="bg-white border rounded-xl p-5 space-y-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
