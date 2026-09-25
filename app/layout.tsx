import "./styles.css";
import PwaRegister from "./pwa-register";

export const metadata = {
  title: "PILI Centralni Magacin",
  description: "Centralni magacin PILI",
  manifest: "/manifest-magacin.webmanifest",
  appleWebApp: {
    capable: true,
    title: "PILI Magacin",
    statusBarStyle: "default" as const,
  },
  icons: {
    icon: [
      { url: "/icons/pili-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/pili-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/pili-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = {
  themeColor: "#0b3d91",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
