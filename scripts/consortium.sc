// Host the owner party on both participants.
//
// Sentry's policy stops the agent exceeding its delegation. This is the other
// half: the owner party itself stops being something a single node hosts. Once
// both participants host it, neither operator's node is the sole place the
// owner exists, and the governance members reading as the owner do so from
// their own participant rather than borrowing someone else's.
//
// Run against a fresh ledger, before the party holds contracts. Adding a host
// to a party that already has an active contract set needs party replication
// (export_party_acs / import_party_acs), which is a separate exercise.
//
// Two things here are not obvious, and both cost real time to find:
//
//  1. Use `propose`, not `propose_delta`. Each node computes a delta against
//     its own view of the store, so proposing a delta from both sides produces
//     two different mappings: sandbox proposes sandbox+pebblebox while
//     pebblebox proposes pebblebox alone. Neither ever reaches full
//     authorization and no error is raised, because both are valid proposals
//     for different transactions.
//
//  2. Target the synchronizer store explicitly. A party allocated through the
//     Ledger API has its mapping in the synchronizer store, and the authorized
//     store is empty for it, so a proposal aimed at the default store is
//     counting serials from the wrong place and fails TOPOLOGY_SERIAL_MISMATCH.
//
// Run: dpm canton-console -c scripts/remote.conf --no-tty < scripts/consortium.sc

import com.digitalasset.canton.config.RequireTypes.PositiveInt
import com.digitalasset.canton.topology.transaction.ParticipantPermission
import com.digitalasset.canton.topology.admin.grpc.TopologyStoreId

val owner = sandbox.parties.list().map(_.party).filter(_.filterString.startsWith("Owner")).head
val syncId = sandbox.synchronizers.list_connected().head.synchronizerId
val store = TopologyStoreId.Synchronizer(syncId)
println("PARTY=" + owner.toProtoPrimitive)

val current = sandbox.topology.party_to_participant_mappings.list(synchronizerId = syncId, filterParty = owner.filterString)
println("BEFORE=" + current.map(h => h.item.participants.map(_.participantId.uid.identifier.str).mkString("+") + "|serial=" + h.context.serial.value).mkString(" ;; "))

// Sandbox keeps Submission so it can still submit on the owner's behalf;
// pebblebox takes Confirmation so it hosts and confirms without submitting.
val hosts = Seq((sandbox.id, ParticipantPermission.Submission), (pebblebox.id, ParticipantPermission.Confirmation))

// Both nodes sign the identical transaction at the identical serial, which is
// what lets the two signatures add up to full authorization.
val next = PositiveInt.tryCreate(current.map(_.context.serial.value).max + 1)

val a = scala.util.Try(sandbox.topology.party_to_participant_mappings.propose(
  party = owner, newParticipants = hosts, threshold = PositiveInt.one,
  serial = Some(next), store = store, mustFullyAuthorize = false))
println("SANDBOX_PROPOSED=" + a.isSuccess + a.failed.map(e => " :: " + e.getMessage.replaceAll("\\s+", " ").take(200)).getOrElse(""))

val b = scala.util.Try(pebblebox.topology.party_to_participant_mappings.propose(
  party = owner, newParticipants = hosts, threshold = PositiveInt.one,
  serial = Some(next), store = store, mustFullyAuthorize = false))
println("PEBBLEBOX_ACCEPTED=" + b.isSuccess + b.failed.map(e => " :: " + e.getMessage.replaceAll("\\s+", " ").take(200)).getOrElse(""))

Thread.sleep(6000)
val after = sandbox.topology.party_to_participant_mappings.list(synchronizerId = syncId, filterParty = owner.filterString)
println("AFTER=" + after.map(h => h.item.participants.map(p => p.participantId.uid.identifier.str + ":" + p.permission).mkString("+") + "|threshold=" + h.item.threshold.value + "|serial=" + h.context.serial.value).mkString(" ;; "))
println("HOSTED_BY_PEBBLEBOX=" + pebblebox.parties.hosted(filterParty = owner.filterString).nonEmpty)
sys.exit(0)
