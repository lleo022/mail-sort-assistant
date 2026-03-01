import "./globals.css";
import { SessionProviderWrapper } from "./SessionProviderWrapper.jsx";

export const metadata = {
  title: "Inbox Zero Assistant",
  description: "Triage your inbox with AI",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}