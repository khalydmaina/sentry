// Topology operations for the outage demonstration.
//
// Driven by scripts/outage-demo.py, which passes the action in SENTRY_ACTION:
//
//   down            sidebox leaves the synchronizer, as if its operator lost it
//   up              sidebox rejoins
//   threshold=N     how many hosting participants must confirm for the owner
//   show            report the current hosting and threshold
//
// Disconnecting is how a hosting node goes away without killing the process
// that also runs the other two participants.

import com.digitalasset.canton.config.RequireTypes.PositiveInt
import com.digitalasset.canton.topology.transaction.ParticipantPermission
import com.digitalasset.canton.topology.admin.grpc.TopologyStoreId

val action = sys.env.getOrElse("SENTRY_ACTION", "show")
val owner = sandbox.parties.list().map(_.party).filter(_.filterString.startsWith("Owner")).head
val syncId = sandbox.synchronizers.list_connected().head.synchronizerId
val store = TopologyStoreId.Synchronizer(syncId)

// Reconnecting takes longer than disconnecting and varies, so both poll for
// the state they want rather than sleeping a guessed amount.
def waitFor(want: Boolean): Boolean = { var n = 0; while (n < 40 && scala.util.Try(sidebox.synchronizers.list_connected().nonEmpty).getOrElse(false) != want) { Thread.sleep(1000); n += 1 }; scala.util.Try(sidebox.synchronizers.list_connected().nonEmpty).getOrElse(false) == want }

if (action == "down") { scala.util.Try(sidebox.synchronizers.disconnect_all()); println("SIDEBOX=down settled=" + waitFor(false)) }
// reconnect_all brings back a participant that never connected, but does not
// restore one that was explicitly disconnected. Reconnecting the registered
// alias does, and immediately.
else if (action == "up") {
  val aliases = scala.util.Try(sidebox.synchronizers.list_registered().map(_._1.synchronizerAlias.unwrap)).getOrElse(Nil)
  aliases.foreach(a => scala.util.Try(sidebox.synchronizers.reconnect(a)))
  if (aliases.isEmpty) scala.util.Try(sidebox.synchronizers.reconnect_all())
  println("SIDEBOX=up settled=" + waitFor(true))
}
else if (action.startsWith("threshold=")) {
  val want = PositiveInt.tryCreate(action.drop(10).toInt)
  val current = sandbox.topology.party_to_participant_mappings.list(synchronizerId = syncId, filterParty = owner.filterString)
  val hosts = Seq((sandbox.id, ParticipantPermission.Submission), (sidebox.id, ParticipantPermission.Confirmation))
  val next = PositiveInt.tryCreate(current.map(_.context.serial.value).max + 1)
  val a = scala.util.Try(sandbox.topology.party_to_participant_mappings.propose(party = owner, newParticipants = hosts, threshold = want, serial = Some(next), store = store, mustFullyAuthorize = false))
  val b = scala.util.Try(sidebox.topology.party_to_participant_mappings.propose(party = owner, newParticipants = hosts, threshold = want, serial = Some(next), store = store, mustFullyAuthorize = false))
  Thread.sleep(6000)
  println("THRESHOLD_SET=" + (a.isSuccess && b.isSuccess))
  a.failed.foreach(e => println("  sandbox: " + e.getMessage.replaceAll("\\s+", " ").take(160)))
  b.failed.foreach(e => println("  sidebox: " + e.getMessage.replaceAll("\\s+", " ").take(160)))
}

val now = sandbox.topology.party_to_participant_mappings.list(synchronizerId = syncId, filterParty = owner.filterString)
println("STATE=" + now.map(h => h.item.participants.map(p => p.participantId.uid.identifier.str).mkString("+") + "|threshold=" + h.item.threshold.value).mkString(" ;; "))
println("SIDEBOX_CONNECTED=" + scala.util.Try(sidebox.synchronizers.list_connected().nonEmpty).getOrElse(false))
sys.exit(0)
