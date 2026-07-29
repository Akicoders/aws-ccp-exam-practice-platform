import Link from "next/link";

export default function RootPage() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center p-4"
    >
      <h1 className="text-3xl font-bold text-center mb-8">
        AWS Certified Cloud Practitioner
      </h1>
      <p className="text-text-secondary dark:text-text-dark-secondary mb-8 text-center">
        Practice Exam Platform
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/en"
          className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-white font-medium hover:bg-brand-700 transition-colors"
        >
          English
        </Link>
        <Link
          href="/es"
          className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-white font-medium hover:bg-brand-700 transition-colors"
        >
          Español
        </Link>
      </div>
    </main>
  );
}
