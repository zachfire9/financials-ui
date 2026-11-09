# Example backups

Fake, public-safe plans for trying out the app. Each file is a normal JSON backup: load it with **Import JSON backup** in the sidebar, enter the projection settings listed below, and click **Calculate projection**.

Backups don't store projection settings, so enter them by hand.

| File | What it shows | Saving years | Drawdown years | Annual withdrawal | Inflation |
|---|---|---|---|---|---|
| `on-track-retirement.json` | A fully funded plan: four accounts, a 401(k) whose contribution rises with inflation, and money left at the end ("Your money lasts all 30 years, with $1.59M left."). | 20 | 30 | 70,000 | 3 |
| `runs-short.json` | A plan that runs out: balances peak in year 18, the money runs short from year 40, and the shortfall shows in both charts. | 18 | 32 | 85,000 | 3 |
| `market-downturn-in-drawdown.json` | Losses during drawdown: a stock fund with a −12% drawdown return shrinks while a bond fund keeps growing. Negative growth appears below the line in the money in/out chart, and withdrawals run short from year 6. | 0 | 8 | 130,000 | 0 |
| `early-career-saver.json` | Saving only, no drawdown: small balances grow to about $1.74M after 30 years. The money in/out chart shows growth overtaking contributions. | 30 | 0 | 0 | 0 |
| `two-retirement-dates.json` | Two people retiring five years apart, with their own 401(k)s and IRAs plus joint accounts. Person 2 stops contributing after year 13 while Person 1 keeps contributing until year 18; meanwhile the household withdraws a smaller amount from the pooled money. See the settings below. ("Your money lasts all 30 years after you’ve both retired, with $620K left.") | see below | 30 | 90,000 | 3 |
| `many-accounts.json` | Nine accounts: the first eight get distinct chart colors and the ninth falls back to gray. Use **By account** in the balance chart to compare them. | 15 | 25 | 60,000 | 3 |
| `missing-and-duplicate-ids.json` | Import repair: one account has no ID and one repeats another's ID. Both get fresh IDs on import, so editing one never changes another. Ephemeral mode only; the API's backup import requires valid, unique IDs. | any | any | any | any |
| `invalid/invalid-items.json` | Import validation: a bad currency code, a blank name, a negative amount and a contribution stored as text. The import is rejected with messages naming each item and field, and your current accounts stay as they were. | – | – | – | – |

For `two-retirement-dates.json`, tick **Two of us, retiring at different times** and keep the default names: **Person 1**, 18 years until retiring; **Person 2**, 13 years; **Withdrawal while one works**, 30,000. The accounts are already tagged with their owners.

All files except `missing-and-duplicate-ids.json` and `invalid/` also import into the API-backed (persistent) mode.

Keep real financial data out of this folder.
