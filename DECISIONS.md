# Decisions

Film Repertory pipeline (2026-10-13)

- Good Time is rated 5 in `data/owner/letterboxd.json` (owner answer). Letterboxd's own 3 is kept in `letterboxdRating`.
- Feature filter: drop documentary and TV movie genres, video releases, runtimes under 40 minutes, unreleased titles, and credits with fewer than 25 TMDB votes. Reason: keeps the graph to real features; counts per seed are in the report.
- Promotion rule: a non-seed person is promoted when they share 2 or more films with the same seed (not 2 across all seeds). Reason: repeat pairs are the point of the site. Capped at 200 people (cut from 400 to keep the build small), ranked by total shared films.
- Promoted people contribute their 25 most-voted films in the role that got them promoted. Reason: keeps the build near 5k films instead of 15k+.
- Actors count as credited only when billed in the top 10 on a film; actor seeds use billing 15 or better for their own filmography.
- Actor/actor and producer/producer pairs are not stored in `collaborations.json`. Reason: they would multiply the file size and no planned view reads them. Film credits in `films.json` still list every billed actor.
- Only the TMDB job "Producer" maps to the producer role; Executive Producer is left unmapped on purpose (769 credits in the seed directors' films alone).
- Crawl raw responses live in `data/raw` (gitignored). `data/build` is committed.
