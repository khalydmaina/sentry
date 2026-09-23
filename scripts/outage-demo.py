#!/usr/bin/env python3
"""What happens to the owner's wallet when a hosting node goes away.

The owner party is hosted by two participants with a hosting threshold of 1,
so either host can confirm on its behalf. This takes one of them off the
synchronizer and shows the wallet carrying on.

On the threshold, and why this demo stops at 1
----------------------------------------------
The threshold is the dial between staying available and refusing to act alone.
At 1 the wallet survives losing a host. At 2 neither operator can move the
owner's funds by itself, which sounds strictly better and is a trap:

  * raising the threshold to 2 needs both hosts online, because both must sign
    the topology change
  * once it is 2 and one host is gone, the owner cannot act at all, and that
    includes lowering the threshold again, because that too needs both

So a hosting threshold equal to the number of hosts has no recovery path from
a single outage. It wants a third host, or an operational answer for restoring
the one that went away. Found the hard way: this demo wedged a test ledger
into exactly that state, and the only way out was to throw it away.

Run against a ledger started by scripts/ledger.sh, after a wallet exists.
"""
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
import uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WALLET, COUNTERPARTY = "http://localhost:6864", "http://localhost:7864"


def call(base, method, path, body=None, timeout=45):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"} if data else {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read() or "null")


def party(base, user):
    return call(base, "GET", f"/v2/users/{user}")["user"]["primaryParty"]


def connected():
    """Whether sidebox is on the synchronizer, according to the console."""
    return any("SIDEBOX_CONNECTED=true" in l for l in console("show"))


def bring_up(attempts=6):
    """Reconnecting is slower than disconnecting and sometimes needs asking twice."""
    for _ in range(attempts):
        console("up")
        if connected():
            return True
    return False


def console(action):
    """Runs a console action and returns the summary lines it printed."""
    env = dict(os.environ, SENTRY_ACTION=action,
               PATH=os.path.expanduser("~/.dpm/bin") + ":" + os.environ["PATH"])
    with open(f"{ROOT}/scripts/outage.sc") as f:
        out = subprocess.run(["dpm", "canton-console", "-c", f"{ROOT}/scripts/remote.conf", "--no-tty"],
                             stdin=f, capture_output=True, text=True, env=env, timeout=300).stdout
    wanted = ("SIDEBOX=", "STATE=", "SIDEBOX_CONNECTED=")
    return [l.lstrip("@ ").strip() for l in out.splitlines() if l.lstrip("@ ").startswith(wanted)]


def spend(owner, policy_cid, merchant, amount):
    """The owner paying directly. Succeeds, or reports the ledger's own reason."""
    try:
        call(WALLET, "POST", "/v2/commands/submit-and-wait-for-transaction", {
            "commands": {"commands": [{"ExerciseCommand": {
                "templateId": "#sentry:Wallet.Policy:WalletPolicy", "contractId": policy_cid,
                "choice": "OwnerTransfer",
                "choiceArgument": {"to": merchant, "qty": f"{amount:.10f}", "memo": "outage check"}}}],
                "commandId": str(uuid.uuid4()), "userId": "owner", "actAs": [owner]}})
        return True, "settled"
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return False, json.loads(body).get("code", f"HTTP_{e.code}")
        except Exception:
            return False, f"HTTP_{e.code}"
    except Exception as e:
        return False, type(e).__name__


def live_policy(owner):
    end = call(WALLET, "GET", "/v2/state/ledger-end")["offset"]
    rows = call(WALLET, "POST", "/v2/state/active-contracts", {
        "eventFormat": {"filtersByParty": {owner: {"cumulative": [
            {"identifierFilter": {"WildcardFilter": {"value": {"includeCreatedEventBlob": False}}}}]}}, "verbose": True},
        "activeAtOffset": end})
    for r in rows:
        e = (r.get("contractEntry") or {}).get("JsActiveContract", {}).get("createdEvent")
        if e and e["templateId"].endswith("WalletPolicy"):
            return e["contractId"]
    return None


def main():
    owner = party(WALLET, "owner")
    merchant = party(COUNTERPARTY, "merchant")
    if not live_policy(owner):
        sys.exit("No live policy on this ledger. Run scripts/hosting-check.py first to create a wallet.")

    def step(label, action=None):
        if action:
            for line in console(action):
                print(f"    {line}")
        ok, why = spend(owner, live_policy(owner), merchant, 1.0)
        print(f"  {label:<40} owner can spend: {'yes' if ok else 'NO (' + why + ')'}\n")
        return ok

    print("\nOwner hosted by sandbox and sidebox, hosting threshold 1.")
    print("Spending 1.00 as the owner at each step.\n")
    a = step("both hosts on the synchronizer")
    b = step("sidebox off the synchronizer", "down")

    # Report what actually happened rather than assuming the reconnect took.
    back = bring_up()
    print(f"    sidebox reconnected: {back}")
    c = step("sidebox back on" if back else "sidebox still off")

    ok = a and b and c and back
    print("\nLosing a host did not stop the wallet, and it came back."
          if ok else "\nSee the results above: something did not behave as expected.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
