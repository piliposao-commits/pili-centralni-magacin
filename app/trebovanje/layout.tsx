export const metadata = {
  title: "PILI Trebovanje",
  description: "Trebovanje robe iz PILI centralnog magacina",
  manifest: "/manifest-trebovanje.webmanifest",
  appleWebApp: {
    capable: true,
    title: "PILI Trebovanje",
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
  themeColor: "#1c2f82",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function TrebovanjeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
