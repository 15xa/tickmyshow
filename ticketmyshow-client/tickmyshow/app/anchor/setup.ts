// anchor/setup.ts

import { useMemo } from "react";
import {
  useConnection,
  useWallet,
  WalletContextState,
} from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

// 1️⃣ Import your JSON IDL directly
import idl from "./idl.json";

// 2️⃣ Export the on-chain program ID
export const PROGRAM_ID = new PublicKey(idl.address);

// 3️⃣ Until you generate real TS types, alias it:
export type Tickmyshow = Idl;

// 4️⃣ Hook that gives you `program`, `provider`, and `wallet`—all correctly typed
export function useAnchorProgram(): {
  program: Program<Tickmyshow> | null;
  provider: AnchorProvider | null;
  wallet: WalletContextState;
} {
  const { connection } = useConnection();
  const wallet = useWallet();

  // AnchorProvider wrapped in useMemo to avoid re-instantiating
  const provider = useMemo<AnchorProvider | null>(() => {
    if (!wallet.publicKey) return null;
    return new AnchorProvider(connection, wallet as any, {
      commitment: "confirmed",
    });
  }, [connection, wallet]);

  // Program<Tickmyshow> wrapped in useMemo too
  const program = useMemo<Program<Tickmyshow> | null>(() => {
    if (!provider) return null;
    return new Program<Tickmyshow>(idl as unknown as Idl, provider);
  }, [provider]);

  return { program, provider, wallet };
}

// 5️⃣ Your PDA helpers, untouched from before:

/** Event PDA: seeds = ["event", name, date] */
export function getEventPDA(
  name: string,
  date: number
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("event"),
      Buffer.from(name),
      new BN(date).toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  );
}

/** Ticket PDA: seeds = ["ticket", eventPubkey, nftMintPubkey] */
export function getTicketPDA(
  event: PublicKey,
  nftMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("ticket"), event.toBuffer(), nftMint.toBuffer()],
    PROGRAM_ID
  );
}

/** Gate PDA: seeds = ["entrypoint", eventPubkey, entrypointId] */
export function getGatePDA(
  event: PublicKey,
  entrypointId: string
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("entrypoint"),
      event.toBuffer(),
      Buffer.from(entrypointId),
    ],
    PROGRAM_ID
  );
}

export function getCheckinPDA(
  ticket: PublicKey,
  timestamp: number
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("checkin"),
      ticket.toBuffer(),
      new BN(timestamp).toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  );
}
