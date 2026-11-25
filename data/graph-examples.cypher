// Example queries for data/micemax.rl (and the same graph in Aura). Run: relate query --read-only -d data/micemax.rl < data/graph-examples.cypher

// 1. What fits JADM32's Friday evening window, within 4 km of the main venue, at ¥8,000 or less
MATCH (c:Conference {id: 'jadm32'})-[:HELD_AT {is_main: 1}]->(venue:Place),
      (e:Experience)-[f:FITS]->(w:Window {id: 'jadm32-w09'}),
      (e)-[:HAS_STOP {n: 1}]->(:Plan)-[:AT]->(p:Place)
WHERE e.price_jpy <= 8000 AND point.distance(venue.location, p.location) < 4000
RETURN e.id AS experience, e.kind AS kind, e.price_jpy AS price_jpy, f.travel_min AS travel_min,
       round(point.distance(venue.location, p.location)) AS metres
ORDER BY travel_min, price_jpy;

// 2. Who from JADM32 joined the Donbe seafood bowl, by role and home
MATCH (c:Conference {id: 'jadm32'})<-[:ATTENDS]-(a:Attendee)-[j:JOINED]->(e:Experience {id: 'short-donbe-nijo-market'})
WHERE NOT j.cancelled
RETURN a.role AS role, count(*) AS people, collect(coalesce(a.home_prefecture, a.home_country)) AS homes
ORDER BY people DESC, role;

// 3. What conferences similar to JHM29 picked
MATCH (c:Conference {id: 'jhm29'})-[s:SIMILAR_TO]->(o:Conference)<-[:ATTENDS]-(:Attendee)-[j:JOINED]->(e:Experience)
WHERE NOT j.cancelled
RETURN o.id AS similar, s.score AS score, e.id AS experience, e.kind AS kind, count(*) AS joins
ORDER BY joins DESC, experience LIMIT 8;
