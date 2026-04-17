export default function QuestionsLoading() {
  return (
    <div className="flex flex-col flex-1 p-6 gap-4">
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-9 w-36 bg-muted animate-pulse rounded-lg" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" style={{ opacity: 1 - i * 0.18 }} />
      ))}
    </div>
  )
}
