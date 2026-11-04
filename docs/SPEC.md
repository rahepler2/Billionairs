# Lifted: product notes

Built from the "BillWall — Product & Security Spec" (2026-11-03). This file records what the MVP implements and the decisions made while building it.

## Name and positioning

**Lifted.** A giver "Lifts" a bill, and neighbors get "lifted." The name points at the outcome (people helped) and at the giver's credit (lifting someone up), not at debt or shame.

- Tagline: *Real bills. Real people. Real generosity.*
- Leaderboard → **The Honor Roll** (opt-in, ranked by impact points)
- Billionaire board → **The Luminaries** (reserved seats; giving through Lifted is celebrated; sourced outside philanthropy is always shown)
- Tiers: Lifter ($0.01+), Champion ($1k+), Patron ($25k+), Luminary ($250k+)

Other names considered: Patron, Halo, Benefactor, HonorRoll, PaidForward. Run a trademark check before launch (open question in the spec).

## MVP scope (implemented)

1. **Post:** upload → sanitize → optional Claude extraction → poster confirms → story (280 chars) → limits: 1 active bill, $2,500 cap.
2. **Verify:** forensics, duplicate vectors, known-biller directory, flags, human review queue with biller-confirmation attestation. Unverified bills never go live.
3. **Vote:** verified accounts, 1 per bill, 10 per day; ranking blends votes, urgency and waiting time.
4. **Pay:** partial Lifts pool; donor-paid 5% fee + grossed-up processing; Stripe Connect to the bill-pay partner; partner webhook marks Paid; full refunds on rejection.
5. **Honor Roll / Luminaries:** impact = $1 → 1 pt, + 50 pts per household; claim-your-seat flow; methodology page; corrections channel.

## Decisions

- **Seed Luminaries are fictional.** Real names must come from a sourced list via the importer, after counsel review. That avoids shipping unverified claims about real people in the repo.
- **Account numbers are typed, not read by the model.** The extraction schema has no PII fields, so a hosted model can at most see the image (only under ZDR) and can never write PII back.
- **Donor-paid fee** is the default (`PLATFORM_FEE_BPS`); the optional-tip A/B test isn't built yet.
- **Mock payment mode** runs the whole money loop locally and is refused in production.
