# RipGuard — Sablier Discord Announcement

> Post in Sablier Discord, appropriate channel (integrations, show-and-tell, or built-on-sablier).
> Tone: fellow builder, technical, appreciative of the protocol.
> Last updated: 2026-03-10 by CMO

---

## Channel Target

**Server:** Sablier Discord
**Channel:** #integrations, #built-on-sablier, #showcase, or the closest equivalent
**Tone:** Builder-to-builder, technical, genuine. Not marketing fluff.

---

## Post Copy

```
Hey Sablier team + community 👋

Just launched RipGuard — a profit locker for crypto degens built entirely on Sablier Lockup v2.0 on Base.

**What it does:**
Traders lock USDC into time-locked streams after taking profits. The lock is non-cancelable — Sablier's contract enforces it, not ours. That's the whole product: removing the option to panic-sell back in.

**Why we built on Sablier:**
We specifically needed non-cancelable lockup. Sablier's LL (Lockup Linear) with `isCancelable: false` is exactly that — battle-tested, audited, and already on Base. We're not building a new lock primitive; we're building a UX layer on top of yours.

No custom Solidity on our end. Frontend calls `createWithDurationsLL()` directly. Broker fee (0.5%) collected natively via Sablier's broker mechanism — cleanest integration path available.

**Technical:**
- Sablier Lockup v2.0 on Base: `0xb5D78DD3276325f5FAF3106Cc4Acc56E28e0Fe3B`
- 3 preset schedules (7d cliff, 30d linear, 7d cliff + 90d vest) + custom
- Open source: github.com/fielding/ripguard

🔗 https://ripguard.xyz
🧪 Testnet: https://testnet.ripguard.xyz

Would love to be listed in any Sablier ecosystem/integrations page if that's a thing. Happy to answer questions about the integration approach.
```

---

## Notes

- Lead with the technical integration story — the Sablier community cares about how we use the protocol
- Mention `isCancelable: false` and `createWithDurationsLL()` — shows we actually understand the protocol
- The broker fee mention is important — validates legitimate use of their fee mechanism, not a workaround
- Goal is: (a) visibility in Sablier ecosystem, (b) potential listing on any integrations page they maintain
- Secondary goal: warm intro for a potential formal partnership / co-marketing relationship
- If anyone from the Sablier team responds, loop in the board for follow-up
