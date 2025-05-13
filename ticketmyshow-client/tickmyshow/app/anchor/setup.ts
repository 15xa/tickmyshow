import { useMemo } from "react";
import {
  useConnection,
  useWallet,
  WalletContextState,
} from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import idl from "./idl.json";

export type Tickmyshow = Idl;
export const PROGRAM_ID = new PublicKey(idl.address);
export function useAnchorProgram(): {
  program: Program<Tickmyshow> | null;
  provider: AnchorProvider | null;
  wallet: WalletContextState;
} {
  const { connection } = useConnection();
  const wallet = useWallet();

  const provider = useMemo<AnchorProvider | null>(() => {
    if (!wallet.publicKey) return null;
    return new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
  }, [connection, wallet]);

  const program = useMemo<Program<Tickmyshow> | null>(() => {
    if (!provider) return null;
    return new Program<Tickmyshow>(idl as unknown as Idl, provider);
  }, [provider]);

  return { program, provider, wallet };
}


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
    new PublicKey(idl.address)
  );
}

export function getTicketPDA(
  event: PublicKey,
  nftMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("ticket"), event.toBuffer(), nftMint.toBuffer()],
    new PublicKey(idl.address)
  );
}

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
    new PublicKey(idl.address)
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
    new PublicKey(idl.address)
  );
}
