import "./globals.css";

export const metadata = {
  title: {
    default: "SocraticOS — notes that quiz you back",
    template: "%s",
  },
  description:
    "An all-in-one productivity and Socratic learning workspace. Take notes, have them explained, then find out what you actually understood.",
};

export const viewport = {
  themeColor: "#12151e",
};

/**
 * Applies the saved theme before first paint.
 *
 * Workspace.jsx sets `data-theme` from a mount effect, which is correct but
 * runs after the browser has already painted — so a reader on the light theme
 * got a flash of dark on every navigation, and the landing page (which never
 * mounts Workspace) ignored their choice entirely. Running this synchronously
 * in <head> fixes both. It is wrapped in try/catch because localStorage throws
 * in private mode, and a failure here must not take the page down.
 */
const THEME_BOOTSTRAP = `
try {
  var t = localStorage.getItem("socratic_theme");
  if (t === "light") {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.classList.add("light");
  }
} catch (e) {}
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-screen bg-ink-950 text-ink-100">{children}</body>
    </html>
  );
}
