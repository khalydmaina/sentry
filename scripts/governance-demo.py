#!/usr/bin/env python3
"""Releasing a held request takes two signatures, from two different nodes.

The agent raises a request the policy holds. A member proposes releasing it,
each member confirms, and only once the threshold is met does the money move.
The interesting step is the one in the middle: one confirmation is not enough,
and the ledger says so rather than this script.

Alice is hosted by the wallet node and Bob by the governance node, so the two
confirmations genuinely come from parties that no single participant speaks
for.

Run against a ledger started by scripts/ledger.sh, after a wallet exists.
"""
import json
import re
import sys
import urllib.error
import urllib.request
import uuid

WALLET = "http://localhost:6864"
COUNTERPARTY = "http://localhost:7864"
GOVERNANCE = "http://localhost:8864"

POLICY = "#sentry:Wallet.Policy:WalletPolicy"
RULES = "#governance-core-v1:Governance.Rules:GovernanceRules"
APPROVAL = "#sentry-governance:Wallet.Governed:GovernedApproval"
ACTION_IFACE = "#governance-action-v1:Governance.Action:GovernableAction"


def call(base, method, path, body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"} if data else {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read() or "null")


def submit(base, user, party, command, read_as=None):
    cmds = {"commands": [command], "commandId": str(uuid.uuid4()), "userId": user, "actAs": [party]}
    if read_as:
        cmds["readAs"] = read_as
    return call(base, "POST", "/v2/commands/submit-and-wait-for-transaction", {"commands": cmds})["transaction"]


def try_submit(*a, **k):
    """Returns (ok, reason). The reason is the ledger's own, not ours."""
    try:
        return True, submit(*a, **k)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            cause = json.loads(body).get("cause", "")
        except Exception:
            cause = body
        # The useful part is the requirement the contract refused on.
        m = re.search(r"The requirement '([^']+)'", cause)
        return False, (m.group(1) if m else cause[:120])


def party(base, user):
    return call(base, "GET", f"/v2/users/{user}")["user"]["primaryParty"]


def contracts(base, p, suffix, read_as=None):
    end = call(base, "GET", "/v2/state/ledger-end")["offset"]
    filters = {p: {"cumulative": [{"identifierFilter": {"WildcardFilter": {"value": {"includeCreatedEventBlob": False}}}}]}}
    for extra in read_as or []:
        filters[extra] = filters[p]
    rows = call(base, "POST", "/v2/state/active-contracts",
                {"eventFormat": {"filtersByParty": filters, "verbose": True}, "activeAtOffset": end})
    out = []
    for r in rows:
        e = (r.get("contractEntry") or {}).get("JsActiveContract", {}).get("createdEvent")
        if e and e["templateId"].endswith(suffix):
            out.append(e)
    return out


def main():
    owner = party(WALLET, "owner")
    agent = party(WALLET, "agent")
    alice = party(WALLET, "alice")
    bob = party(GOVERNANCE, "bob")
    merchant = party(COUNTERPARTY, "merchant")

    rules = contracts(WALLET, owner, "GovernanceRules")
    if not rules:
        sys.exit("No GovernanceRules. Run scripts/governance-setup.py first.")
    rules_cid = rules[0]["contractId"]
    threshold = int(rules[0]["createArgument"]["threshold"])
    print(f"\nGovernance: {threshold} of {len(rules[0]['createArgument']['members']['map'])} members")
    print(f"  Alice  hosted by sandbox\n  Bob    hosted by sidebox\n")

    policies = contracts(WALLET, owner, "WalletPolicy")
    if not policies:
        sys.exit("No WalletPolicy. Create a wallet first, e.g. scripts/hosting-check.py.")
    policy_cid = policies[0]["contractId"]

    # The agent asks for more than the policy auto-approves, so it is held.
    tx = submit(WALLET, "agent", agent, {"ExerciseCommand": {
        "templateId": POLICY, "contractId": policy_cid, "choice": "RequestTransfer",
        "choiceArgument": {"amount": "120.0000000000", "counterparty": merchant, "memo": "supplier invoice"}}})
    held = [e["CreatedEvent"]["contractId"] for e in tx["events"]
            if e.get("CreatedEvent") and e["CreatedEvent"]["templateId"].endswith("PendingApproval")]
    if not held:
        sys.exit("The request was not held; check the policy's auto-approve threshold.")
    print(f"  agent requests 120.00        -> HELD, waiting on the owner")

    # A member proposes the release. The proposal is signed by the owner.
    policy_cid = contracts(WALLET, owner, "WalletPolicy")[0]["contractId"]
    tx = submit(WALLET, "owner", owner, {"CreateCommand": {
        "templateId": APPROVAL,
        "createArguments": {"owner": owner, "proposer": alice, "pending": held[0],
                            "freshPolicy": policy_cid, "memo": "supplier invoice, above the threshold"}}})
    proposal = next(e["CreatedEvent"]["contractId"] for e in tx["events"]
                    if e.get("CreatedEvent") and e["CreatedEvent"]["templateId"].endswith("GovernedApproval"))
    print(f"  Alice proposes a release")

    def confirm(base, user, member):
        tx = submit(base, user, member, {"ExerciseCommand": {
            "templateId": RULES, "contractId": rules_cid, "choice": "GovernanceRules_ConfirmAction",
            "choiceArgument": {"confirmer": member, "actionProposalCid": proposal}}}, read_as=[owner])
        return next(e["CreatedEvent"]["contractId"] for e in tx["events"]
                    if e.get("CreatedEvent") and e["CreatedEvent"]["templateId"].endswith("GovernanceConfirmation"))

    def execute(base, user, member, confirmations):
        return try_submit(base, user, member, {"ExerciseCommand": {
            "templateId": RULES, "contractId": rules_cid, "choice": "GovernanceRules_ExecuteConfirmedAction",
            "choiceArgument": {"executor": member, "actionProposalCid": proposal, "confirmations": confirmations}}},
            read_as=[owner])

    def balance(p, base=WALLET):
        hs = contracts(base, p, "WalletHolding")
        return sum(float(h["createArgument"]["amount"]) for h in hs)

    first = confirm(WALLET, "alice", alice)
    print(f"  Alice confirms               -> 1 of {threshold}")

    ok, why = execute(WALLET, "alice", alice, [first])
    print(f"  try to release on 1          -> {'MOVED (unexpected)' if ok else 'REFUSED: ' + why}")

    second = confirm(GOVERNANCE, "bob", bob)
    print(f"  Bob confirms, from sidebox   -> 2 of {threshold}")

    before = balance(merchant, COUNTERPARTY)
    ok, why = execute(WALLET, "alice", alice, [first, second])
    after = balance(merchant, COUNTERPARTY)
    print(f"  release on 2                 -> {'SETTLED' if ok else 'REFUSED: ' + str(why)}")
    print(f"\n  merchant balance {before:.2f} -> {after:.2f}")
    return 0 if ok and after > before else 1


if __name__ == "__main__":
    sys.exit(main())
