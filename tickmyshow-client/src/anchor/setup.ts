import { IdlAccounts, Program } from "@coral-xyz/anchor";
import { IDL, Counter } from "./idl";
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import * as buffer from "buffer";

const programId = new PublicKey("5FFwn1xD4ae3kttPDNoHmnW2x2tfekLQXUbRiaj6mBeG");
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
window.Buffer = buffer.Buffer; 

export const program = new Program<Counter>(IDL, programId, {
  connection,
});

export const [counterPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("counter")],
  program.programId,
);

export type CounterData = IdlAccounts<Counter>["counter"];