const anchor = require("@coral-xyz/anchor");
const { SystemProgram, SYSVAR_CLOCK_PUBKEY } = anchor.web3;
const { Program } = anchor;
const assert = require("assert");

// Configure the local cluster.
const provider = anchor.AnchorProvider.local();
anchor.setProvider(provider);

// Assume your program workspace name is 'tickmyshow'
const program = anchor.workspace.Tickmyshow;

// Variables to share between tests if needed
let eventPda;
let ticketPda;
// Note: checkinPda derivation is tricky due to timestamp seed for 'init'.
// See comment in check_in test for details.
let checkinPda;
let owner = anchor.web3.Keypair.generate(); // Keypair for the ticket owner and checkin signer

describe("Tickmyshow", () => {

  // Airdrop SOL to the owner who will pay for ticket and checkin accounts
  before(async () => {
    await provider.connection.requestAirdrop(
      owner.publicKey,
      100 * anchor.web3.LAMPORTS_PER_SOL
    );
  });

  it("Initializes an event!", async () => {
    const eventName = "Dev Meetup";
    const eventDate = new Date().getTime(); // Example timestamp

    // Calculate the PDA for the event account
    [eventPda] = anchor.web3.Pubkey.findProgramAddressSync(
      [
        Buffer.from("event"), // Seed: "event"
        provider.wallet.publicKey.toBuffer(), // Seed: creator's public key (default wallet)
        Buffer.from(eventName), // Seed: event name
      ],
      program.programId // Your program's public key
    );

    // Call the init_event instruction
    await program.methods
      .initEvent(eventName, new anchor.BN(eventDate)) // Use BN for i64
      .accounts({
        event: eventPda,
        creator: provider.wallet.publicKey, // Creator is the default wallet
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Fetch and assert the created event account data
    const eventAccount = await program.account.event.fetch(eventPda);

    assert.strictEqual(eventAccount.creator.toString(), provider.wallet.publicKey.toString());
    assert.strictEqual(eventAccount.name, eventName);
    assert.strictEqual(eventAccount.date.toString(), new anchor.BN(eventDate).toString());
    // assert.strictEqual(eventAccount.bump, _eventBump); // Optionally check bump
  });

  it("Mints a ticket for the event!", async () => {
    // Ensure eventPda is set from the previous test or a fixture
    if (!eventPda) {
      throw new Error("Event not initialized before minting ticket.");
    }

    // Calculate the PDA for the ticket account
    [ticketPda] = anchor.web3.Pubkey.findProgramAddressSync(
      [
        Buffer.from("ticket"), // Seed: "ticket"
        eventPda.toBuffer(), // Seed: event's public key (PDA)
        owner.publicKey.toBuffer(), // Seed: owner's public key (new Keypair)
      ],
      program.programId // Your program's public key
    );

    // Call the mint_ticket instruction
    await program.methods
      .mintTicket()
      .accounts({
        ticket: ticketPda,
        owner: owner.publicKey, // Owner is the signer/payer for the ticket
        event: eventPda, // Pass the event PDA key
        systemProgram: SystemProgram.programId,
      })
      .signers([owner]) // Owner must sign the transaction
      .rpc();

    // Fetch and assert the created ticket account data
    const ticketAccount = await program.account.ticket.fetch(ticketPda);

    assert.strictEqual(ticketAccount.event.toString(), eventPda.toString());
    assert.strictEqual(ticketAccount.owner.toString(), owner.publicKey.toString());
    // assert.strictEqual(ticketAccount.bump, _ticketBump); // Optionally check bump
  });

  it("Checks in a ticket!", async () => {
      // Ensure ticketPda and owner are set from the previous test or a fixture
      if (!ticketPda || !owner) {
          throw new Error("Ticket not minted before check-in.");
      }

      // Calculate the PDA for the checkin account.
      // NOTE: Your Rust code uses `&clock.unix_timestamp.to_le_bytes()` as a seed for an `init` PDA.
      // Deriving the *exact* timestamp seed deterministically *before* the transaction hits the block
      // is not reliably possible in a standard test setup.
      // The test below uses a simplified PDA calculation based only on ticketPda for demonstration.
      // If your Rust checkin PDA *must* include timestamp as a seed for `init`, the test needs
      // a different PDA definition in Rust (e.g., without timestamp in address) or a more complex testing approach.
      [checkinPda] = anchor.web3.Pubkey.findProgramAddressSync(
          [
              Buffer.from("checkin"), // Seed: "checkin"
              ticketPda.toBuffer(),   // Seed: ticket's public key (PDA)
              // Omit timestamp seed here as it's not predictable before txn
              // If your Rust code used [b"checkin", ticket.key().as_ref()], this would be correct.
          ],
          program.programId
      );


      // Call the check_in instruction
      await program.methods
          .checkIn()
          .accounts({
              checkin: checkinPda,
              owner: owner.publicKey, // Owner is the signer for checkin
              ticket: ticketPda,    // Pass the ticket PDA key
              clock: SYSVAR_CLOCK_PUBKEY, // Use the Clock sysvar
              systemProgram: SystemProgram.programId,
          })
          .signers([owner]) // Owner must sign
          .rpc();

      // Fetch and assert the created checkin account data
      const checkinAccount = await program.account.checkInData.fetch(checkinPda);

      // Verify the data written to the account
      assert.strictEqual(checkinAccount.ticket.toString(), ticketPda.toString());
      assert.strictEqual(checkinAccount.owner.toString(), owner.publicKey.toString());
      assert.ok(checkinAccount.timestamp > 0); // Check that a timestamp was recorded
      // assert.strictEqual(checkinAccount.bump, _checkinBump); // Optionally check bump
  });

});