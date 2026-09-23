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
//
// See scripts/consortium.sc for why this uses `propose` against the
// synchronizer store rather than `propose_delta` against the default one.

import com.digitalasset.canton.config.RequireTypes.PositiveInt
import com.digitalasset.canton.topology.transaction.ParticipantPermission
import com.digitalasset.canton.topology.admin.grpc.TopologyStoreId

Seq(sandbox, pebblebox, sidebox).foreach(p => scala.util.Try(p.synchronizers.reconnect_all()))
Thread.sleep(3000)
println("CONNECTED=" + Seq(sandbox, pebblebox, sidebox).map(p => p.name + ":" + p.synchronizers.list_connected().size).mkString(" "))
sys.exit(0)
