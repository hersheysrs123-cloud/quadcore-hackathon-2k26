import "./globals.css";

export const metadata = {
  title: "SocraticOS",
  description:
    "An all-in-one productivity and Socratic learning workspace.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-950 text-ink-100">{children}</body>
    </html>
  );
}
