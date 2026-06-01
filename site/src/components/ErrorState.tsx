export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="border border-border bg-surface rounded p-6 my-4">
      <div className="text-text font-medium mb-1">Something went wrong</div>
      <div className="text-muted text-sm mb-3">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="text-accent text-sm hover:underline">Retry</button>
      )}
    </div>
  );
}
