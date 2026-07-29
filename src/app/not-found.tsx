import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center p-4 text-center"
    >
      <h1 className="text-4xl font-bold mb-4">Page Not Found</h1>
      <p className="text-text-secondary dark:text-text-dark-secondary mb-8">
        The page you are looking for does not exist.
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-white font-medium hover:bg-brand-700 transition-colors"
      >
        Go to Home
      </Link>
    </main>
  );
}
