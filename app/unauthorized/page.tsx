export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-6">
      <div className="max-w-md w-full bg-white border rounded-lg p-8 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">Unauthorized</h1>
        <p className="mt-3 text-sm text-gray-600">
          You are logged in but do not have permission to access this page.
        </p>
      </div>
    </div>
  );
}

