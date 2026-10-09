# Content Revenue OS — Winner Library V1 Specification

## Project goal

Build the first working module of the project **Content Revenue OS**.

The first module is called **WINNER LIBRARY V1**.

Its purpose is to store, compare and learn from content, creator accounts, advertisements, hooks, funnels and offers that show evidence of working.

## Working rules

- Work only inside the current `Content-Revenue-OS` project folder.
- Do not access unrelated files on this computer.
- Do not use paid external services.
- Do not connect external APIs yet.
- Keep the architecture simple and maintainable.
- Prefer local storage.
- Minimize dependencies.
- Use the selected zero-install approach: a local PowerShell web server plus browser UI with data saved locally as JSON.
- Do not overengineer.
- Build and test the application yourself.

## UI

Create a local web application that opens in a browser on localhost.

Visual identity:
- dark blue + orange
- simple
- professional
- easy for a non-technical user

## Winner Library data model

Each saved item needs these fields:

1. Title
2. Creator / Account
3. Platform
   - Instagram
   - TikTok
   - YouTube Shorts
   - YouTube
   - Facebook
   - LinkedIn
   - Advertisement
   - Other
4. Source URL
5. Date discovered
6. Niche / Market
7. Target audience
8. Topic
9. Content type
   - Proof
   - Story
   - Tutorial
   - Mistake
   - Warning
   - Comparison
   - Case Study
   - List
   - Behind the scenes
   - Advertisement
   - Other
10. Hook
11. First 1-3 second mechanism
12. Visual opening
13. Story structure
14. Problem / Pain Point
15. Desired outcome
16. Emotional trigger
17. Proof / credibility mechanism
18. Objection handling
19. CTA
20. Lead magnet
21. Funnel / monetization path
22. Offer / product
23. Visible performance signals
24. Views
25. Likes
26. Comments
27. Shares / Sends
28. Saves
29. Followers of account when known
30. Why it probably worked
31. Reusable underlying mechanism
32. Evidence strength
   - Strong
   - Medium
   - Weak
33. Research source
   - Manual
   - Astra
   - Claude Research
   - ChatGPT
   - Other
34. Pain intensity score 1-10
35. Urgency score 1-10
36. Purchase intent score 1-10
37. Content potential score 1-10
38. Differentiation score 1-10
39. Ease of production score 1-10
40. Monetization potential score 1-10
41. Evidence strength score 1-10
42. Overall opportunity score
43. Our status
   - Discovered
   - Review
   - Approved for test
   - Testing
   - Winner
   - Failed
   - Archived
44. Our adaptation idea
45. Our test result
46. Revenue generated
47. Notes

## Functions for V1

Create:

- Dashboard
- Add new winner
- Edit item
- Delete item with confirmation
- Search
- Filters for platform, content type, status and niche
- Sort by overall opportunity score
- Table/list view
- Detail view
- KPI cards showing:
  - total items
  - approved tests
  - winners
  - average opportunity score

## Scoring

Automatically calculate an **Overall Opportunity Score** from:

- Pain intensity
- Urgency
- Purchase intent
- Content potential
- Differentiation
- Ease of production
- Monetization potential
- Evidence strength

Use a transparent formula and document it.

## Data portability

Add:

- Export all data as CSV
- Export all data as JSON
- Import JSON in a safe way

Future agents must be able to write structured findings into the Winner Library.

## Seed data

Add one example entry based on this validated research pattern:

**System:**  
Proof Reel → Keyword Comment → DM Lead Magnet → Email → Low-Ticket Product

**Example hook pattern:**  
“I tested [specific method] for [N] days — here’s what actually happened.”

**Content principles:**
- show proof early
- one painful problem
- one tested fix
- real evidence
- concise CTA
- monetization through owned product rather than platform payouts

Do not invent fake revenue or performance numbers.

## Project memory

Create a `CLAUDE.md` in the project root.

It should explain:

- Content Revenue OS purpose
- ChatGPT = orchestration, strategy, final decisions and QA
- Astra = market, creator, competitor and audience research
- Claude Code = software, automation, integrations and technical implementation
- Hailuo = video generation
- Canva Business = branding and final creative assets
- human approval remains mandatory before publishing content
- evidence is more important than hype
- sales/leads matter more than vanity metrics
- never add another paid tool unless it creates a material advantage
- build simple before automating

## Documentation

Create a `README.md` with:

- what the app does
- chosen technology
- how to start it on Windows
- where the local data is stored
- how to back it up
- how imports/exports work

## Testing

After implementation:

1. Start the application.
2. Verify the dashboard loads.
3. Create a test record.
4. Edit it.
5. Search for it.
6. Filter it.
7. Export data.
8. Delete the temporary test record.
9. Report any remaining problems.

Do not stop after generating code.

Build a working V1 and verify it.

At the end tell me:

- what you built
- which files were created
- how I start the app
- what should be built next

Do not build any further automation yet.
