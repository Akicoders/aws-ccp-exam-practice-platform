import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AWS CCP Practice Exam",
  description:
    "Practice for the AWS Certified Cloud Practitioner (CLF-C02) exam with real questions",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var store = JSON.parse(localStorage.getItem('aws-ccp-exam:v1') || '{}');
                  if (store.theme === 'dark' || (!store.theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="bg-surface text-text dark:bg-surface-dark dark:text-text-dark min-h-screen">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
