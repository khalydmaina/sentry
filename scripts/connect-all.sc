// Connect every participant to the synchronizer, and host the owner party on
// the two that govern it.
//
// The sandbox's built-in bootstrap connects some participants and not others,
// and which ones varies between runs, so this reconnects all of them rather
// than assuming. reconnect_all is idempotent, so a participant that is already
// connected is untouched.
//
// Hosting the owner on sandbox and sidebox, and deliberately not on pebblebox,
// is what lets one topology show two things at once: the owner exists on more
// than one independent node, and the counterparty's node still never receives
// the policy.

Seq(sandbox, pebblebox, sidebox).foreach { p =>
  scala.util.Try(p.synchronizers.reconnect_all())
  // reconnect_all does not restore a participant that was explicitly
  // disconnected, so registered aliases are reconnected by name as well.
  scala.util.Try(p.synchronizers.list_registered().map(_._1.synchronizerAlias.unwrap).foreach(a => scala.util.Try(p.synchronizers.reconnect(a))))
}
Thread.sleep(3000)
println("CONNECTED=" + Seq(sandbox, pebblebox, sidebox).map(p => p.name + ":" + p.synchronizers.list_connected().size).mkString(" "))
sys.exit(0)
