import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SystemProgram, PublicKey } from "@solana/web3.js";
import { BN } from "bn.js"; // Import BN
import * as assert from "assert";

// Assume your program IDL is generated and available via anchor.workspace
import { Tickmyshow } from "../target/types/tickmyshow";

// Configure the local cluster.
const provider = anchor.AnchorProvider.local();
anchor.setProvider(provider);

// Assume your program workspace name is 'tickmyshow'
const program = anchor.workspace.Tickmyshow as Program<Tickmyshow>;

let eventPda: PublicKey;
let ticketPda: PublicKey;
let checkinPda: PublicKey;
let owner = anchor.web3.Keypair.generate(); // Keypair for the ticket owner and checkin signer

describe("Tickmyshow", () => {

  // Airdrop SOL to the owner who will pay for ticket and checkin accounts
  before(async () => {
    await provider.connection.requestAirdrop(
      owner.publicKey,
      100 * anchor.web3.LAMPORTS_PER_SOL // A generous amount
    );
    console.log("Airdropped SOL to owner:", owner.publicKey.toBase58());
  });

  it("Initializes an event!", async () => {
    const eventName = "Dev Meetup";
    // Using a fixed date or a simple timestamp for predictability in tests
    const eventDate = Math.floor(Date.now() / 1000); // Current timestamp in seconds
    const capacity = 1; // Set to 1 to test overflow later

    // Calculate the PDA for the event account using findProgramAddressSync
    [eventPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("event"),
        provider.wallet.publicKey.toBuffer(),
        Buffer.from(eventName),
      ],
      program.programId
    );

    console.log("Event PDA:", eventPda.toBase58());

    await program.methods
      // Use new BN for the date
      .initEvent(eventName, new BN(eventDate), capacity)
      .accounts({
        event: eventPda,
        creator: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const eventAccount = await program.account.event.fetch(eventPda);
    assert.strictEqual(eventAccount.creator.toString(), provider.wallet.publicKey.toString());
    assert.strictEqual(eventAccount.name, eventName);
    // Compare BN instances directly or convert to string
    assert.strictEqual(eventAccount.date.toString(), new BN(eventDate).toString());
    assert.strictEqual(eventAccount.capacity, capacity);
    assert.strictEqual(eventAccount.issued, 0);

    console.log("Event initialized successfully!");
  });

  it("Mints a ticket for the event!", async () => {
    // Calculate the PDA for the ticket account using findProgramAddressSync
    [ticketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("ticket"),
        eventPda.toBuffer(),
        owner.publicKey.toBuffer(),
      ],
      program.programId
    );

    console.log("Ticket PDA:", ticketPda.toBase58());

    await program.methods
      .mintTicket()
      .accounts({
        ticket: ticketPda,
        owner: owner.publicKey,
        event: eventPda, // Ensure event account is passed
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const ticketAccount = await program.account.ticket.fetch(ticketPda);
    assert.strictEqual(ticketAccount.event.toString(), eventPda.toString());
    assert.strictEqual(ticketAccount.owner.toString(), owner.publicKey.toString());
    // Note: The contract doesn't store ticket bump, but the account struct does. Not asserting bump here.

    // Fetch the event account again to check the issued count
    const eventAccount = await program.account.event.fetch(eventPda);
    assert.strictEqual(eventAccount.issued, 1);

    console.log("Ticket minted successfully!");
  });

  it("Fails to mint another ticket if capacity exceeded", async () => {
    // This test relies on the event capacity being set to 1 in the first test

    const anotherUser = anchor.web3.Keypair.generate();
    await provider.connection.requestAirdrop(
      anotherUser.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    console.log("Airdropped SOL to another user:", anotherUser.publicKey.toBase58());


    // Calculate the PDA for the second ticket using findProgramAddressSync
    const [secondTicketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("ticket"),
        eventPda.toBuffer(),
        anotherUser.publicKey.toBuffer(),
      ],
      program.programId
    );

    console.log("Second Ticket PDA (expected to fail mint):", secondTicketPda.toBase58());

    try {
      await program.methods
        .mintTicket()
        .accounts({
          ticket: secondTicketPda,
          owner: anotherUser.publicKey,
          event: eventPda, // Ensure event account is passed
          systemProgram: SystemProgram.programId,
        })
        .signers([anotherUser])
        .rpc();
      // If the RPC call above succeeds, the test should fail
      assert.fail("Should have thrown due to capacity limit.");
    } catch (err) {
      // Improve error assertion: check the specific Anchor error code
      // The error structure might vary slightly based on Anchor version.
      // Common structure: err.error.errorCode.code
      const anchorError = err as any; // Use any type to access properties without strict checking initially
      console.log("Caught expected error:", anchorError.logs || anchorError); // Log the error for inspection if needed

      // Check if it's an Anchor error with the expected error code
      assert.ok(
          anchorError.error &&
          anchorError.error.errorCode &&
          anchorError.error.errorCode.code === "SoldOut",
          `Expected SoldOut error, but caught: ${err}`
      );
      console.log("Caught expected SoldOut error!");
    }
  });

  it("Checks in a ticket!", async () => {
    // Calculate the PDA for the checkin account using findProgramAddressSync
    // NOTE: The contract uses [b"checkin", ticket.key().as_ref()] as seeds.
    // The original test code included clock timestamp, which is non-deterministic
    // for findProgramAddressSync unless you use a fixed value (which defeats the purpose).
    // We will use the seeds defined in the contract's CheckIn context struct.
    [checkinPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("checkin"),
        ticketPda.toBuffer(), // Use the previously minted ticket's PDA
      ],
      program.programId
    );

    console.log("Checkin PDA:", checkinPda.toBase58());

    // To pass the Clock sysvar, you need to import SYSVAR_CLOCK_PUBKEY
    const { SYSVAR_CLOCK_PUBKEY } = anchor.web3;

    await program.methods
      .checkIn()
      .accounts({
        checkin: checkinPda,
        owner: owner.publicKey, // Owner signs the checkin
        ticket: ticketPda, // Pass the ticket account
        clock: SYSVAR_CLOCK_PUBKEY, // Pass the Clock sysvar
        systemProgram: SystemProgram.programId,
      })
      .signers([owner]) // Owner needs to sign to pay for the checkin account creation
      .rpc();

    // Fetch the checkin account. Assuming the account type is 'CheckInData' based on your contract.
    const checkinAccount = await program.account.checkInData.fetch(checkinPda);
    assert.strictEqual(checkinAccount.ticket.toString(), ticketPda.toString());
    assert.strictEqual(checkinAccount.owner.toString(), owner.publicKey.toString());
    assert.ok(checkinAccount.timestamp.toNumber() > 0); // Timestamp is i64 in Rust, BN in JS

    console.log("Ticket checked in successfully!");
  });
});