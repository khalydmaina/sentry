import { useEffect, useRef, useState, type ReactNode } from 'react'
import holdingSrc from '../../../main/daml/Wallet/Holding.daml?raw'
import policySrc from '../../../main/daml/Wallet/Policy.daml?raw'
import recordsSrc from '../../../main/daml/Wallet/Records.daml?raw'
import { Micro } from '../components/ui'

const FILES = [
  { name: 'Wallet/Policy.daml', src: policySrc },
  { name: 'Wallet/Holding.daml', src: holdingSrc },
  { name: 'Wallet/Records.daml', src: recordsSrc },
]

const INDEX: Array<{ template: string; file: number; signed: string; observed: string; choices: Array<{ name: string; controller: string; note: string }> }> = [
  {
    template: 'WalletPolicy',
    file: 0,
    signed: 'owner',
    observed: 'agent',
    choices: [
      { name: 'RequestTransfer', controller: 'agent', note: 'nonconsuming · the agent’s only way to spend' },
      { name: 'OwnerTransfer', controller: 'owner', note: 'no caps, not counted in the window' },
      { name: 'UpdatePolicy', controller: 'owner', note: 'checks the new holding belongs to this wallet' },
    ],
  },
  {
    template: 'PendingApproval',
    file: 0,
    signed: 'owner, agent',
    observed: 'none',
    choices: [
      { name: 'Approve', controller: 'owner', note: 'takes the current policy id, re-checks the balance' },
      { name: 'Reject', controller: 'owner', note: 'writes a RejectedTransfer' },
    ],
  },
  { template: 'WalletHolding', file: 1, signed: 'issuer (bank)', observed: 'owner, agent', choices: [{ name: 'Transfer', controller: 'owner', note: 'asserts qty > 0 and qty ≤ amount' }] },
  { template: 'ExecutedTransfer', file: 2, signed: 'owner', observed: 'agent, counterparty', choices: [] },
  { template: 'RejectedTransfer', file: 2, signed: 'owner', observed: 'agent', choices: [] },
]

const KEYWORDS = /\b(module|import|template|with|where|signatory|observer|ensure|choice|nonconsuming|controller|do|let|if|then|else|data|deriving|pure|create|exercise|fetch|archive|assertMsg|getTime)\b/g

/** Lime marks choice names and nothing else; strings in bone; no rainbow. */
function highlight(line: string): ReactNode[] {
  const out: ReactNode[] = []
  const comment = line.indexOf('--')
  const code = comment >= 0 ? line.slice(0, comment) : line
  const tail = comment >= 0 ? line.slice(comment) : ''
  const choice = code.match(/^(\s*(?:nonconsuming\s+)?choice\s+)(\w+)(.*)$/)
  const push = (text: string, key: string) => {
    let last = 0
    const parts = text.split(/("[^"]*")/)
    parts.forEach((part, i) => {
      if (i % 2 === 1) {
        out.push(<span className="st" key={`${key}s${i}`}>{part}</span>)
        return
      }
      let m: RegExpExecArray | null
      KEYWORDS.lastIndex = 0
      last = 0
      while ((m = KEYWORDS.exec(part))) {
        if (m.index > last) out.push(<span className="tx" key={`${key}${i}t${m.index}`}>{part.slice(last, m.index)}</span>)
        out.push(<span className="kw" key={`${key}${i}k${m.index}`}>{m[0]}</span>)
        last = m.index + m[0].length
      }
      if (last < part.length) out.push(<span className="tx" key={`${key}${i}e`}>{part.slice(last)}</span>)
    })
  }
  if (choice) {
    push(choice[1], 'a')
    out.push(<span className="ch" key="choice">{choice[2]}</span>)
    push(choice[3], 'b')
  } else {
    push(code, 'c')
  }
  if (tail) out.push(<span className="cm" key="cm">{tail}</span>)
  return out
}

const choiceLine = (line: string) => line.match(/^\s*(?:nonconsuming\s+)?choice\s+(\w+)/)?.[1]

export function Contract() {
  const [file, setFile] = useState(0)
  const [target, setTarget] = useState('RequestTransfer')
  const source = useRef<HTMLPreElement>(null)
  const lines = FILES[file].src.replace(/\n$/, '').split('\n')

  useEffect(() => {
    const pre = source.current
    const el = pre?.querySelector<HTMLElement>('.ln.target')
    if (!pre) return
    pre.scrollTo({ top: el ? Math.max(0, el.offsetTop - 60) : 0, behavior: 'smooth' })
  }, [file, target])
  return (
    <div className="page shell">
      <div className="page-head">
        <div>
          <Micro>Contract · the source this app talks to</Micro>
          <h1 className="h1">Read the rules the ledger runs.</h1>
        </div>
        <p className="section-note">Imported straight from main/daml at build time, so this page cannot drift from the deployed package.</p>
      </div>
      <div className="contract">
        <aside className="contract-index">
          {INDEX.map((t) => (
            <div className="idx-template" key={t.template}>
              <button
                type="button"
                className="name"
                onClick={() => {
                  setFile(t.file)
                  setTarget(t.template)
                }}
                style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', color: 'var(--bone)' }}
              >
                {t.template}
              </button>
              <div className="who">
                signed by {t.signed} · observed by {t.observed}
              </div>
              {t.choices.map((c) => (
                <div className="choice" key={c.name}>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(t.file)
                      setTarget(c.name)
                    }}
                    style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--signal)', fontWeight: 500 }}
                  >
                    {c.name}
                  </button>{' '}
                  · {c.controller}
                  <div className="help">{c.note}</div>
                </div>
              ))}
            </div>
          ))}
        </aside>
        <div style={{ minWidth: 0 }}>
          <div className="file-tabs" role="tablist">
            {FILES.map((f, i) => (
              <button key={f.name} role="tab" aria-selected={file === i} onClick={() => { setFile(i); setTarget('') }}>
                {f.name}
              </button>
            ))}
          </div>
          <pre className="source" ref={source}>
            <code>
              {lines.map((l, i) => (
                <span className={`ln ${target && (choiceLine(l) === target || l.trim() === `template ${target}`) ? 'target' : ''}`} key={i}>
                  {highlight(l)}
                  {'\n'}
                </span>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </div>
  )
}
