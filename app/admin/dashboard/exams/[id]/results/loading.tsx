export default function ResultsLoading() {
  return (
    <div className="flex flex-col flex-1 p-6 gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-muted animate-pulse rounded-xl" />
    </div>
  )
}
