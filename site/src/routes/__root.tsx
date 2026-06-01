import { createRootRoute, Link, Outlet } from "@tanstack/react-router";

function Nav() {
  return (
    <header className="border-b border-border bg-surface px-6 py-3 flex items-center gap-6">
      <span className="font-bold text-accent">PGC Telemetry</span>
      <nav className="flex gap-4 text-sm">
        {/* TanStack Router v1 code-based routing has a known type-inference cycle on Link.to / navigate({to,params}). Drop the casts below if/when the upstream fix lands or this project migrates to file-based routing. */}
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Link to={"/matches" as any} className="text-muted [&.active]:text-text">Matches</Link>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Link to={"/balance/powerups" as any} className="text-muted [&.active]:text-text">Balance · Powerups</Link>
      </nav>
    </header>
  );
}

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-full flex flex-col">
      <Nav />
      <main className="flex-1 px-6 py-6 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  ),
});
