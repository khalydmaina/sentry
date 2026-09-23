// Host the owner party on sandbox and sidebox, the two participants that
// govern it. Run once, against a fresh ledger, before the party holds
// contracts: adding a host to a party with an active contract set needs party
// replication, which is a different exercise.
//
// Two traps, both of which cost real time and neither of which reports an
// error when you hit it:
//
//  1. `propose`, not `propose_delta`. Each node computes a delta against its
//     own view of the store, so proposing from both sides yields two different
//     mappings: one node proposes both hosts, the other proposes only itself.
//     Neither reaches full authorization and nothing complains, because both
//     are valid proposals for transactions that are not the same one.
//
//  2. Target the synchronizer store explicitly. A party allocated through the
//     Ledger API has its mapping there while the authorized store is empty for
//     it, so a default-store proposal counts serials from the wrong place and
//     fails with TOPOLOGY_SERIAL_MISMATCH.

import com.digitalasset.canton.config.RequireTypes.PositiveInt
import com.digitalasset.canton.topology.transaction.ParticipantPermission
import com.digitalasset.canton.topology.admin.grpc.TopologyStoreId

val owner = sandbox.parties.list().map(_.party).filter(_.filterString.startsWith("Owner")).head
val syncId = sandbox.synchronizers.list_connected().head.synchronizerId
val store = TopologyStoreId.Synchronizer(syncId)
val current = sandbox.topology.party_to_participant_mappings.list(synchronizerId = syncId, filterParty = owner.filterString)

// sandbox keeps Submission so it can submit for the owner; sidebox takes
// Confirmation so it hosts and confirms without submitting.
val hosts = Seq((sandbox.id, ParticipantPermission.Submission), (sidebox.id, ParticipantPermission.Confirmation))
val next = PositiveInt.tryCreate(current.map(_.context.serial.value).max + 1)

// Both nodes sign the identical transaction at the identical serial, which is
// what lets the two signatures add up to full authorization.
val a = scala.util.Try(sandbox.topology.party_to_participant_mappings.propose(party = owner, newParticipants = hosts, threshold = PositiveInt.one, serial = Some(next), store = store, mustFullyAuthorize = false))
val b = scala.util.Try(sidebox.topology.party_to_participant_mappings.propose(party = owner, newParticipants = hosts, threshold = PositiveInt.one, serial = Some(next), store = store, mustFullyAuthorize = false))
println("PROPOSED=" + a.isSuccess + " ACCEPTED=" + b.isSuccess)
a.failed.foreach(e => println("SANDBOX_ERR=" + e.getMessage.replaceAll("\\s+", " ").take(200)))
b.failed.foreach(e => println("SIDEBOX_ERR=" + e.getMessage.replaceAll("\\s+", " ").take(200)))

Thread.sleep(6000)
val after = sandbox.topology.party_to_participant_mappings.list(synchronizerId = syncId, filterParty = owner.filterString)
println("HOSTS=" + after.map(h => h.item.participants.map(p => p.participantId.uid.identifier.str + ":" + p.permission).mkString("+")).mkString(" ;; "))
sys.exit(0)
