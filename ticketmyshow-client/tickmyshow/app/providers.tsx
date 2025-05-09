// app/providers.tsx
"use client";
import React, { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

import {
  SolflareWalletAdapter,
  AlphaWalletAdapter,
} from "@solana/wallet-adapter-wallets";


import "@solana/wallet-adapter-react-ui/styles.css";

export default function Providers({ children }: { children: React.ReactNode }) {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(
    () => `https://api.${network.toLowerCase()}.solana.com`,
    [network]
  );

  const wallets = useMemo(
    () => [ 
      new SolflareWalletAdapter({ network }),
      new AlphaWalletAdapter(),
    ],
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
