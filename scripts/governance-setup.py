#!/usr/bin/env python3
"""Put the owner's held queue under shared control.

Creates one GovernanceRules contract naming two members and a threshold of two.
Alice is hosted by the wallet node and Bob by the governance node, so releasing
a held request needs confirmations from parties that no single participant
speaks for.

The rules contract is signed by the owner alone. Members are deliberately not
observers on it: the framework treats member visibility as topology, where each
member's participant hosts the governance party and reads as it. That is
already true here, which is why the owner is hosted on both nodes.

Run once, after the parties exist. Idempotent: it does nothing if rules already
exist for this owner.
"""
import json
import sys
import urllib.error
import urllib.request
import uuid

WALLET = "http://localhost:6864"
GOVERNANCE = "http://localhost:8864"

RULES = "#governance-core-v1:Governance.Rules:GovernanceRules"
CONFIRMATION_TIMEOUT_HOURS = 24


def call(base, method, path, body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"} if data else {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read() or "null")
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {base}{path} -> {e.code}\n{e.read().decode()[:400]}")


def party(base, user):
    return call(base, "GET", f"/v2/users/{user}")["user"]["primaryParty"]


def existing_rules(owner):
    end = call(WALLET, "GET", "/v2/state/ledger-end")["offset"]
    rows = call(WALLET, "POST", "/v2/state/active-contracts", {
        "eventFormat": {"filtersByParty": {owner: {"cumulative": [
            {"identifierFilter": {"WildcardFilter": {"value": {"includeCreatedEventBlob": False}}}}]}}, "verbose": True},
        "activeAtOffset": end})
    return [r for r in rows
            if (r.get("contractEntry") or {}).get("JsActiveContract", {})
            .get("createdEvent", {}).get("templateId", "").endswith("GovernanceRules")]


def main():
    owner = party(WALLET, "owner")
    alice = party(WALLET, "alice")
    bob = party(GOVERNANCE, "bob")

    if existing_rules(owner):
        print("GOVERNANCE=already configured")
        return 0

    call(WALLET, "POST", "/v2/commands/submit-and-wait-for-transaction", {
        "commands": {
            "commands": [{"CreateCommand": {
                "templateId": RULES,
                "createArguments": {
                    "governanceParty": owner,
                    # DA.Set is a record wrapping a map, so it is not a bare list here.
                    "members": {"map": [[alice, {}], [bob, {}]]},
                    "threshold": "2",
                    "actionConfirmationTimeout": {"microseconds": str(CONFIRMATION_TIMEOUT_HOURS * 3600 * 1_000_000)},
                    "additionalProposers": None,
                },
            }}],
            "commandId": str(uuid.uuid4()),
            "userId": "owner",
            "actAs": [owner],
        }})
    print(f"GOVERNANCE=2 of 2 · Alice on sandbox, Bob on sidebox")
    return 0


if __name__ == "__main__":
    sys.exit(main())
