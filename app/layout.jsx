import "./globals.css";
import { SessionProviderWrapper } from "./SessionProviderWrapper";

export const metadata = {
  title: "Inbox: Zero - Email Manager",
  description: "Organize your inbox with AI",
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