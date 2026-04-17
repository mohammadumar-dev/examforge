export default function AccessLoading() {
  return (
    <div className="flex flex-col flex-1 p-6 gap-6">
      <div className="h-7 w-40 bg-muted animate-pulse rounded-lg" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-32 bg-muted animate-pulse rounded-xl" />
        <div className="h-32 bg-muted animate-pulse rounded-xl" />
      </div>
      <div className="h-48 bg-muted animate-pulse rounded-xl" />
    </div>
  )
}
