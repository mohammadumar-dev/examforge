import { Loader2 } from "lucide-react"

export default function DashboardLoading() {
  return (
    <div className="flex flex-col flex-1 p-6 gap-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-8 w-24 bg-muted animate-pulse rounded-lg ml-auto" />
      </div>
      <div className="grid gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" style={{ opacity: 1 - i * 0.15 }} />
        ))}
      </div>
    </div>
  )
}
