export default function ExamsLoading() {
  return (
    <div className="flex flex-col flex-1 p-6 gap-6">
      <div className="flex items-center justify-between">
        <div className="h-7 w-24 bg-muted animate-pulse rounded-lg" />
        <div className="h-9 w-28 bg-muted animate-pulse rounded-lg" />
      </div>
      <div className="grid gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" style={{ opacity: 1 - i * 0.12 }} />
        ))}
      </div>
    </div>
  )
}
