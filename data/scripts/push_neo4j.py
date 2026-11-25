"""Wipe Neo4j Aura and reload it from data/micemax.rl (the local RelateDB graph), then check counts match.

Usage: .venv/bin/python data/scripts/push_neo4j.py    (needs NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD,
NEO4J_DATABASE in .env). Safe to re-run. Uses the neo4j driver rather than `relate push`, which never deletes
remote data and doesn't create constraints. Runs data/graph-examples.cypher against Aura at the end.
"""
import os
from pathlib import Path

import neo4j
import relate
from neo4j.spatial import WGS84Point

import build_graph
import env

BATCH = 2000
EXAMPLES = Path(__file__).resolve().parent.parent / "graph-examples.cypher"


def connect():
    env.load("NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD", "NEO4J_DATABASE")
    driver = neo4j.GraphDatabase.driver(os.environ["NEO4J_URI"],
                                        auth=(os.environ["NEO4J_USERNAME"], os.environ["NEO4J_PASSWORD"]))
    return driver, os.environ["NEO4J_DATABASE"]


def counts(driver, database):
    q = lambda c: {r[0]: r[1] for r in driver.execute_query(c, database_=database).records}
    return (q("MATCH (n) UNWIND labels(n) AS label RETURN label, count(*) ORDER BY label"),
            q("MATCH ()-[r]->() RETURN type(r), count(*) ORDER BY type(r)"))


def local_graph():
    """{label: [props]} and {(type, from label, to label): [{a, b, p}]} from the .rl file."""
    clean = lambda p: {k: WGS84Point((v.x, v.y)) if isinstance(v, relate.Point) else v for k, v in p.items()}
    with relate.connect(str(build_graph.GRAPH), read_only=True) as conn:
        local = build_graph.counts(conn)
        nodes = {label: [clean(r["p"]) for r in conn.execute(f"MATCH (n:{label}) RETURN properties(n) AS p").fetchall()]
                 for label in local[0]}
        rels = {}
        for r in conn.execute("""MATCH (a)-[r]->(b) RETURN type(r) AS t, labels(a)[0] AS la, labels(b)[0] AS lb,
                                 a.id AS a, b.id AS b, properties(r) AS p""").fetchall():
            rels.setdefault((r["t"], r["la"], r["lb"]), []).append({"a": r["a"], "b": r["b"], "p": clean(r["p"])})
    return local, nodes, rels


def wipe(driver, database):
    for (name,) in driver.execute_query("SHOW CONSTRAINTS YIELD name", database_=database).records:
        driver.execute_query(f"DROP CONSTRAINT `{name}`", database_=database)
    for (name,) in driver.execute_query("SHOW INDEXES YIELD name, type WHERE type <> 'LOOKUP' RETURN name",
                                        database_=database).records:
        driver.execute_query(f"DROP INDEX `{name}` IF EXISTS", database_=database)
    while True:  # batches, so a big graph never needs one huge transaction
        n = driver.execute_query("MATCH (n) WITH n LIMIT 10000 DETACH DELETE n RETURN count(*)",
                                 database_=database).records[0][0]
        if not n:
            break


def load(driver, database, nodes, rels):
    for label, rows in nodes.items():
        driver.execute_query(f"CREATE CONSTRAINT {label.lower()}_id IF NOT EXISTS FOR (n:{label}) REQUIRE n.id IS NODE KEY",
                             database_=database)
        for i in range(0, len(rows), BATCH):
            driver.execute_query(f"UNWIND $rows AS r CREATE (n:{label}) SET n = r", rows=rows[i:i + BATCH],
                                 database_=database)
    for (typ, la, lb), rows in rels.items():
        for i in range(0, len(rows), BATCH):
            driver.execute_query(f"""UNWIND $rows AS r MATCH (a:{la} {{id: r.a}}) MATCH (b:{lb} {{id: r.b}})
                                     CREATE (a)-[x:{typ}]->(b) SET x = r.p""", rows=rows[i:i + BATCH],
                                 database_=database)


def examples():
    text = "\n".join(line for line in EXAMPLES.read_text().splitlines() if not line.startswith("//"))
    return [q.strip() for q in text.split(";") if q.strip()]


def main():
    local, nodes, rels = local_graph()
    driver, database = connect()
    with driver:
        driver.verify_connectivity()
        wipe(driver, database)
        load(driver, database, nodes, rels)
        remote = counts(driver, database)
        ok = remote == local
        for name, l, r in (("nodes", local[0], remote[0]), ("relationships", local[1], remote[1])):
            for k in sorted(set(l) | set(r)):
                print(f"aura {name} {k}: rl {l.get(k, 0)}, aura {r.get(k, 0)}{'' if l.get(k) == r.get(k) else '  MISMATCH'}")
        print("aura: all counts match the .rl file" if ok else "aura: MISMATCH")
        q = examples()[1]
        print("aura example query 2 (who from JADM32 joined the Donbe seafood bowl):")
        for rec in driver.execute_query(q, database_=database).records:
            print("  " + ", ".join(f"{k} {v}" for k, v in rec.items()))


if __name__ == "__main__":
    main()
