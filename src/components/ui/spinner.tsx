export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-hidden="true"
      className={`inline-block h-[1em] w-[1em] flex-shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent border-r-transparent motion-reduce:animate-none ${className}`}
    />
  );
}
