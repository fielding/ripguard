# MARCH 10 LAUNCH GO-SHEET

> Single-file execution guide for RipGuard launch day.
> Board executes this. Everything is copy-paste ready.
> Last updated: 2026-03-10 by CMO

---

## TONIGHT (Before Bed, March 9)

### Screenshot capture — needed for launch thread

| Screenshot | Where | Assigned to Tweet |
|------------|-------|-------------------|
| Landing page hero | https://ripguard.xyz | general / reference |
| `/create` page — preset options visible | https://ripguard.xyz/create | Tweet 5 |
| `/create` page — cliff/vest bar after selecting "Cliff 7D + Vest 90D" preset | https://ripguard.xyz/create | Tweet 6 |
| `/vaults` page | https://ripguard.xyz/vaults | Tweet 7 (skip if no locks) |

Capture at desktop (1440x900). Name them clearly: `create-presets.png`, `create-timeline-bar.png`, `vaults-dashboard.png`, `landing-hero.png`.

---

### Inner circle DMs (send tonight or first thing tomorrow)

Send to 10-20 degen friends/trusted contacts. Use one of these:

**Option A (casual):**
> I built a thing — it locks your USDC on-chain so you can't give back your gains. Time-locked vaults on Base, powered by Sablier. No middleman contracts. Try it with $5 first: ripguard.xyz

**Option B (pain-point lead):**
> You know how you always turn a win into a loss because you can't stop trading? I made a tool that locks your profits into a time vault so future-you can't touch them. Self-custodial, non-cancelable, on Base: ripguard.xyz

**Option C (testnet first):**
> If you want to see how it works without real money, there's a testnet version: testnet.ripguard.xyz — mint free test USDC and try a lock. When you're ready for real: ripguard.xyz

---

## PART 1 — 7:00am ET (Warm-up Tweet)

Post from @ripguardxyz (or board personal):

> launching today at 9am ET.
>
> built a tool that locks your crypto profits in a time vault so you can't panic sell them back.
>
> non-cancelable. self-custodial. powered by @Sablier_HQ on Base.
>
> ripguard.xyz

---

## PART 2 — 9:00am ET (Launch Thread)

Post the full 11-tweet thread from @ripguardxyz.

**Full thread:** `ripguard-internal/marketing/launch-thread.md`

Steps:
1. Open Twitter, log in as @ripguardxyz
2. Draft and post Tweet 1
3. Reply to Tweet 1 with Tweet 2, and so on through Tweet 11
4. After the thread is live: pin it to your profile (··· → Pin to Profile on Tweet 1)
5. QRT the thread from your personal account (if applicable)
6. Post **Tweet B** (standalone announcement) as a separate tweet — not in the thread
7. Post **Tweet D** (infra/dev angle) 1-2 hours later

**Tweet B copy:**
> RipGuard is live on Base.
>
> Lock your USDC into a time-locked vault you can't undo. Non-cancelable. Self-custodial. Powered by @Sablier_HQ.
>
> 3 preset schedules or build your own.
>
> Discipline-as-a-service for degens who know they need it.
>
> ripguard.xyz
>
> (DYOR. Not financial advice.)

---

## PART 3 — 9:15am ET (Hacker News)

Post Show HN on Hacker News.

**Title:** `Show HN: RipGuard – Self-custodial profit locker for crypto degens (Base, USDC)`

**URL:** `https://ripguard.xyz`

**Comment body** (post as a comment on your own submission immediately after it goes live):

> Hey HN — I built RipGuard because I watched myself turn $800 into $22k on a memecoin and then give back everything except $1,200. Not because the trade was bad. Because I kept touching it.
>
> RipGuard is a simple frontend that lets crypto traders lock USDC into time-locked vaults on Base. The key insight: the locks are non-cancelable. Once you lock, there's no "just this once" button. Your future self can't ape back in.
>
> **How it works:**
> 1. Take profit into USDC on Base
> 2. Pick a lock schedule (7 days, 30 days, cliff + vest, or custom)
> 3. Approve and lock
> 4. Walk away. Claim when the schedule unlocks.
>
> **Technical details:**
> - No custom smart contracts. We route through Sablier Lockup v2.0 — a battle-tested token streaming protocol that's handled 534K+ streams across 27 chains since 2019. Your funds sit in Sablier's contract, not ours.
> - Self-custodial. Only the depositor can claim. If our site goes down, you can claim directly on BaseScan.
> - 0.5% broker fee collected by Sablier's native fee mechanism.
> - Built with Next.js, wagmi, and RainbowKit. Frontend only — no backend, no database, no custody.
>
> **Why Base?** Low gas (locking costs cents), native USDC, and that's where the memecoin degens are.
>
> We route through Sablier's audited contracts. Zero custom Solidity — no new attack surface from our code. Open source: github.com/fielding/ripguard — verify what you're signing.
>
> The idea is essentially a "commitment device" — same concept as apps that lock your phone during study time or make you put money on the line to go to the gym. Except this one locks your USDC so you can't YOLO it back into the next dog coin.
>
> Live at https://ripguard.xyz (mainnet) and https://testnet.ripguard.xyz (testnet with free test USDC if you want to try risk-free).
>
> Stack: Next.js / wagmi / Sablier v2.0 / Base L2
>
> Would love feedback on the concept and UX. Is this something you'd actually use?

---

## PART 4 — 9:30am ET (r/defi)

Post to r/defi. Title + body below.

**Title:** `I built a profit locker for degens who can't stop re-entering trades`

**Body:**
> **The problem:** I turned $800 into $22k on a memecoin. Two days later I had $1,200 — not because the market moved, but because I couldn't stop touching it. I kept re-entering, averaging down, "just one more trade."
>
> **What I built:** RipGuard lets you lock USDC into a non-cancelable time vault on Base. You pick a schedule — 7 days, 30 days, cliff + vest, or custom — and your funds are locked in Sablier Lockup v2.0. Non-cancelable. No admin key. No override.
>
> It's basically a commitment device: same concept as betting money on going to the gym, except instead of a third party holding your money, it's a Sablier stream. Self-custodial, audited protocol, you own the NFT.
>
> **Technical:**
> - No custom contracts — routes directly through Sablier v2.0 (534K+ streams, 27 chains, since 2019)
> - 0.5% broker fee via Sablier's native mechanism
> - Open source frontend: github.com/fielding/ripguard
> - If our site goes down, you claim directly on BaseScan
> - Built on Base for low gas (locking costs cents not dollars)
>
> Live at https://ripguard.xyz
> Testnet (free USDC, no risk): https://testnet.ripguard.xyz
>
> Curious if the non-cancelable aspect would actually make this useful to you or just feel too restrictive?
>
> *Not financial advice. Do your own research.*

---

## PART 5 — 3:00pm ET (Traction Check)

Check the metrics. Pick the response playbook.

| Signal | Threshold | Action |
|--------|-----------|--------|
| Twitter impressions on thread | >5,000 | **Viral scenario**: post Tweet E engagement hook, engage every reply, reach out to crypto influencers who might RT |
| HN upvotes | >20 by noon | Comment actively, answer every tech question, link to GitHub |
| Locks created (check Sablier) | Any real locks | Post a brief "first lock in" update tweet |
| Low engagement (thread <500 impressions, HN <5 upvotes) | - | **Quiet scenario**: no panic, proceed to r/CryptoCurrency on Wednesday, focus on inner circle activation |

**Tweet E (engagement hook — post if getting traction):**
> be honest: what % of your lifetime crypto gains have you given back by re-entering trades?
>
> mine was ~95%. built RipGuard because of it: ripguard.xyz
>
> not financial advice.

---

## WEDNESDAY PREP (March 11)

- Post to **r/CryptoCurrency** — discussion format, same story, link in comments
- Check r/defi post — respond to any comments
- Check HN post — respond to any remaining questions
- Begin content calendar Day 2 (launch-week-tweets.md)
- Send Sablier partnership DM if not done yet (see `sablier-partnership-outreach.md`)

---

## KEY ASSETS

| Asset | Location |
|-------|----------|
| Full launch thread (11 tweets) | `ripguard-internal/marketing/launch-thread.md` |
| Launch week tweets (Days 2-7) | `ripguard-internal/marketing/launch-week-tweets.md` |
| Reply templates (CT objections) | `cmo/launch-reply-templates.md` |
| DM share text | `SOFT_LAUNCH_CONTENT.md` |
| Mainnet | https://ripguard.xyz |
| Testnet | https://testnet.ripguard.xyz |
| GitHub | https://github.com/fielding/ripguard |
| Twitter | @ripguardxyz |

---

## CMO IS GO ✓

- ripguard.xyz: live (confirmed 200 OK)
- Meta tags: confirmed (og:title, og:description, twitter:site @ripguardxyz, og:image 1200x630)
- Trust signals: confirmed (Sablier's audited contracts. Non-custodial. Immutable.)
- DYOR disclaimer: confirmed in footer (JUS-432 done)
- FAQ copy: confirmed clean (JUS-462 done — no "funds a formal audit" claim)
- Launch thread: post-aae342f revert — no exact dates, no Vault Command Center, no In Flight stat
- All content accurate as of commit 668f155

**Board action required:** Screenshots tonight. @ripguardxyz credentials. Go at 9am ET.
