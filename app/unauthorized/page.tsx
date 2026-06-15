export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full bg-card border border-border/60 rounded-xl p-8 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Unauthorized</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          You are logged in but do not have permission to access this page.
        </p>
      </div>
    </div>
  );
}
