import json, urllib.request, uuid
W, C = "http://localhost:6864", "http://localhost:7864"
def call(base, m, p, b=None):
    d = json.dumps(b).encode() if b is not None else None
    r = urllib.request.Request(base+p, data=d, method=m, headers={"Content-Type":"application/json"} if d else {})
    try: return json.loads(urllib.request.urlopen(r, timeout=30).read() or "null")
    except urllib.error.HTTPError as e: raise SystemExit(f"{m} {base}{p} -> {e.code}\n{e.read().decode()[:300]}")
party = lambda b,u: call(b,"GET",f"/v2/users/{u}")["user"]["primaryParty"]
owner, agent = party(W,"owner"), party(W,"agent")
bank, merchant = party(C,"bank"), party(C,"merchant")

def submit(base, user, p, cmd):
    return call(base,"POST","/v2/commands/submit-and-wait-for-transaction",
        {"commands":{"commands":[cmd],"commandId":str(uuid.uuid4()),"userId":user,"actAs":[p]}})["transaction"]

tx = submit(C,"bank",bank,{"CreateCommand":{"templateId":"#sentry:Wallet.Holding:WalletHolding",
    "createArguments":{"issuer":bank,"owner":owner,"agent":agent,"amount":"1000.0000000000"}}})
holding = next(e["CreatedEvent"]["contractId"] for e in tx["events"] if e.get("CreatedEvent"))
print("bank minted on pebblebox")

tx = submit(W,"owner",owner,{"CreateCommand":{"templateId":"#sentry:Wallet.Policy:WalletPolicy",
    "createArguments":{"owner":owner,"agent":agent,"issuer":bank,"holding":holding,
    "perTxCap":"200.0000000000","dailyCap":"300.0000000000","allowedCounterparties":[merchant],
    "autoApproveThreshold":"50.0000000000","windowLength":{"microseconds":"86400000000"},"recentSpends":[]}}})
print("owner signed the policy on sandbox")

def acs(base, p):
    end = call(base,"GET","/v2/state/ledger-end")["offset"]
    rows = call(base,"POST","/v2/state/active-contracts",{"eventFormat":{"filtersByParty":{p:{"cumulative":[
        {"identifierFilter":{"WildcardFilter":{"value":{"includeCreatedEventBlob":False}}}}]}},"verbose":True},
        "activeAtOffset":end})
    names=[r["contractEntry"]["JsActiveContract"]["createdEvent"]["templateId"].split(":")[-1]
           for r in rows if r.get("contractEntry",{}).get("JsActiveContract")]
    return sorted(names)

print()
print("owner's contracts, asked of sandbox   :", acs(W, owner))
print("owner's contracts, asked of pebblebox :", acs(C, owner))
print("bank's contracts,  asked of pebblebox :", acs(C, bank))
