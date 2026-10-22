# SwiftRescue: Ambulance and Fire always shown, blood link, pharmacies last: requirements

A small change to the order and content of `/emergency`. How we build it is in [plan.md](plan.md); how we know it is done is in [validation.md](validation.md).
Branch: `feature/swiftrescue-order`, from `main`. It changes decision A1 of [the SwiftRescue feature](../2026-10-17-swiftrescue/requirements.md) for two groups.

## Requirements

[prd.md](../prd.md): **FR-14** (112 first), **FR-15** (emergency contacts in groups, in a fixed order), **FR-16**, **FR-19** (nothing sponsored in SwiftRescue),
**FR-25** (24-hour pharmacies), **US-04**, **US-15** (find blood), **NFR-10** (text 16 px or more, tap targets 48 px or more). Source of truth:
[ui-spec.md](../frontend/ui-spec.md) 2.5 (points 5 to 7). Frontend only: no endpoint, no table, no package.

## The order before this change (the owner asked)

The API sends **seven groups, always, in this order** (FR-15; `GET /emergency`, api-spec): **1 Ambulance, 2 Fire, 3 Police, 4 24-hour emergency units,
5 Roadside assistance, 6 Security, 7 Blood banks**. The page drew them in that order and **hid a group that had no contact** (decision A1): an empty
heading tells a person in danger nothing, and the page stayed short on a phone while real contacts were still being added. After the groups came the
**24-hour pharmacies** section, if there were any.

## What changes

1. **Ambulance and Fire are always drawn, first, even when empty.** An empty one shows its heading and the text
   **"No contacts added yet. In danger, call 112."** The other five groups are still hidden when empty.
2. **The 24-hour pharmacies stay at the bottom**, after everything else, including the new blood card (they were already after the groups).
3. **A link card "Need blood urgently?" to `/blood`** after the emergency groups and before the 24-hour pharmacies.

## Assumed owner decisions

| # | Decision I made | Alternative |
| --- | --- | --- |
| K1 | The order of the groups is unchanged: **Ambulance, Fire** come first because the API sends them first. If an answer ever lacks one of the two (an old saved copy), the page still draws it, with the names "Ambulance" and "Fire". | Sort the groups on the page |
| K2 | **The sentence "We are still adding verified contacts. In danger, call 112." stays** when every group and the pharmacy list are empty. It now sits above the two empty groups (Ambulance, Fire) and the blood card, not instead of them. | Drop the sentence |
| K3 | **The blood card is a plain link card:** a bordered white card with the heading "Need blood urgently?" and the line "Find blood banks and the blood groups they list.", the whole card one link to `/blood`, at least 48 px high, text 16 px or more, **no icon, no cross, nothing red**. It is shown whenever the groups are shown (also from a saved copy offline, where the link works once the connection is back). It is not an advertisement and never says "Sponsored" (FR-19). | A red or icon card |
| K4 | **The "Blood banks" group stays where it is** (seventh). The card is the quick way for a person who needs blood; the group lists the verified blood banks near them. | Remove the group |
| K5 | The share texts (WhatsApp and SMS lists) are unchanged: they list only groups that have a contact. | Add "No contacts added yet" to the shared text |
