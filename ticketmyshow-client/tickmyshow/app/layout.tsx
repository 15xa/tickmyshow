import Providers from "./providers";
import "./globals.css";
import Navbar from "./components/navbar";

export const metadata = {
  title: "TickMyShow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Navbar/>
          {children}</Providers>
      </body>
    </html>
  );
}
