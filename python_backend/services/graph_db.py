import os
from typing import Any, Dict, Iterable, List, Optional

from neo4j import GraphDatabase


_DRIVER = None


def get_driver():
    global _DRIVER
    if _DRIVER is None:
        uri = os.getenv("NEO4J_URI")
        user = os.getenv("NEO4J_USER")
        password = os.getenv("NEO4J_PASSWORD")

        if not uri or not user or not password:
            raise RuntimeError(
                "Missing Neo4j configuration. Set NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD in the environment."
            )

        _DRIVER = GraphDatabase.driver(uri, auth=(user, password))

    return _DRIVER


def close_driver() -> None:
    global _DRIVER
    if _DRIVER is not None:
        _DRIVER.close()
        _DRIVER = None


def _run_write(query: str, params: Optional[Dict[str, Any]] = None):
    with get_driver().session() as session:
        return session.run(query, params or {}).data()


def _run_read(query: str, params: Optional[Dict[str, Any]] = None):
    with get_driver().session() as session:
        return session.run(query, params or {}).data()


def _entity_records(extracted: Dict[str, Any]) -> List[tuple[str, List[Dict[str, Any]]]]:
    entities = extracted.get("entities", {}) or {}
    return [
        ("Person", entities.get("people") or []),
        ("Location", entities.get("locations") or []),
        ("Organization", entities.get("organizations") or []),
        ("Vehicle", entities.get("vehicles") or []),
        ("Phone", entities.get("phones") or []),
    ]


def upsert_entities(extracted: dict, case_id=None) -> dict:
    """Upsert extracted entities and relationships into Neo4j."""
    if not isinstance(extracted, dict):
        raise ValueError("extracted must be a dict")

    node_count = 0
    relationship_count = 0

    with get_driver().session() as session:
        for label, records in _entity_records(extracted):
            for item in records:
                if label == "Person":
                    name = item.get("name")
                    notes = item.get("notes") or ""
                    role = item.get("role") or ""
                    params = {"name": name, "notes": notes, "role": role, "case_id": case_id}
                    query = """
                        MERGE (n:Person {name: $name})
                        ON CREATE SET n.name = $name,
                                      n.role = $role,
                                      n.notes = $notes,
                                      n.mentions = 1,
                                      n.caseId = $case_id
                        ON MATCH SET n.role = CASE WHEN $role <> '' THEN $role ELSE n.role END,
                                     n.notes = CASE WHEN $notes <> '' THEN $notes ELSE n.notes END,
                                     n.mentions = COALESCE(n.mentions, 0) + 1,
                                     n.caseId = $case_id
                    """
                elif label == "Location":
                    name = item.get("name")
                    notes = item.get("notes") or ""
                    lat = item.get("lat")
                    lng = item.get("lng")
                    params = {"name": name, "notes": notes, "lat": lat, "lng": lng, "case_id": case_id}
                    query = """
                        MERGE (n:Location {name: $name})
                        ON CREATE SET n.name = $name,
                                      n.notes = $notes,
                                      n.lat = $lat,
                                      n.lng = $lng,
                                      n.mentions = 1,
                                      n.caseId = $case_id
                        ON MATCH SET n.notes = CASE WHEN $notes <> '' THEN $notes ELSE n.notes END,
                                     n.lat = CASE WHEN $lat IS NOT NULL THEN $lat ELSE n.lat END,
                                     n.lng = CASE WHEN $lng IS NOT NULL THEN $lng ELSE n.lng END,
                                     n.mentions = COALESCE(n.mentions, 0) + 1,
                                     n.caseId = $case_id
                    """
                elif label == "Organization":
                    name = item.get("name")
                    notes = item.get("notes") or ""
                    params = {"name": name, "notes": notes, "case_id": case_id}
                    query = """
                        MERGE (n:Organization {name: $name})
                        ON CREATE SET n.name = $name,
                                      n.notes = $notes,
                                      n.mentions = 1,
                                      n.caseId = $case_id
                        ON MATCH SET n.notes = CASE WHEN $notes <> '' THEN $notes ELSE n.notes END,
                                     n.mentions = COALESCE(n.mentions, 0) + 1,
                                     n.caseId = $case_id
                    """
                elif label == "Vehicle":
                    name = item.get("description") or item.get("name")
                    notes = item.get("notes") or ""
                    params = {"name": name, "notes": notes, "case_id": case_id}
                    query = """
                        MERGE (n:Vehicle {name: $name})
                        ON CREATE SET n.name = $name,
                                      n.notes = $notes,
                                      n.mentions = 1,
                                      n.caseId = $case_id
                        ON MATCH SET n.notes = CASE WHEN $notes <> '' THEN $notes ELSE n.notes END,
                                     n.mentions = COALESCE(n.mentions, 0) + 1,
                                     n.caseId = $case_id
                    """
                elif label == "Phone":
                    name = item.get("number") or item.get("name")
                    notes = item.get("owner") or item.get("notes") or ""
                    params = {"name": name, "notes": notes, "case_id": case_id}
                    query = """
                        MERGE (n:Phone {name: $name})
                        ON CREATE SET n.name = $name,
                                      n.notes = $notes,
                                      n.mentions = 1,
                                      n.caseId = $case_id
                        ON MATCH SET n.notes = CASE WHEN $notes <> '' THEN $notes ELSE n.notes END,
                                     n.mentions = COALESCE(n.mentions, 0) + 1,
                                     n.caseId = $case_id
                    """
                else:
                    continue

                if not name:
                    continue

                session.run(query, params)
                node_count += 1

        for rel in extracted.get("relationships") or []:
            source_name = rel.get("source")
            target_name = rel.get("target")
            rel_type = rel.get("type") or "associate"
            description = rel.get("description") or ""

            if not source_name or not target_name:
                continue

            rel_query = """
                MATCH (source)
                WHERE source.name = $source_name
                MATCH (target)
                WHERE target.name = $target_name
                MERGE (source)-[r:CONNECTED_TO]->(target)
                ON CREATE SET r.type = $rel_type,
                              r.description = $description,
                              r.caseId = $case_id
                ON MATCH SET r.type = $rel_type,
                             r.description = $description,
                             r.caseId = $case_id
            """
            session.run(
                rel_query,
                {
                    "source_name": source_name,
                    "target_name": target_name,
                    "rel_type": rel_type,
                    "description": description,
                    "case_id": case_id,
                },
            )
            relationship_count += 1

    return {"nodes": node_count, "relationships": relationship_count}


def get_graph() -> dict:
    """Return all nodes and relationships as graph JSON for frontend visualization."""
    nodes = []
    edges = []

    node_rows = _run_read(
        """
        MATCH (n)
        RETURN elementId(n) AS id,
               labels(n) AS labels,
               properties(n) AS props
        ORDER BY labels(n)[0], n.name
        """
    )

    for row in node_rows:
        props = row["props"] or {}
        label = (row["labels"] or ["Entity"])[0]
        nodes.append(
            {
                "id": row["id"],
                "label": props.get("name") or label,
                "group": label.lower(),
                "title": props.get("notes") or props.get("name") or "",
            }
        )

    edge_rows = _run_read(
        """
        MATCH (a)-[r]->(b)
        RETURN elementId(r) AS id,
               elementId(a) AS from,
               elementId(b) AS to,
               type(r) AS relationship_type,
               properties(r) AS props
        """
    )

    for row in edge_rows:
        props = row["props"] or {}
        edges.append(
            {
                "id": row["id"],
                "from": row["from"],
                "to": row["to"],
                "label": props.get("type") or row["relationship_type"],
                "title": props.get("description") or "",
            }
        )

    return {"nodes": nodes, "edges": edges}


def get_people_ranked() -> list:
    """Return people sorted by number of touching relationships."""
    rows = _run_read(
        """
        MATCH (p:Person)
        OPTIONAL MATCH (p)-[:CONNECTED_TO]-(other)
        WITH p, COUNT(DISTINCT other) AS connectionCount
        RETURN elementId(p) AS id,
               p.name AS name,
               p.role AS role,
               p.notes AS notes,
               connectionCount
        ORDER BY connectionCount DESC, p.name ASC
        """
    )

    result = []
    for row in rows:
        result.append(
            {
                "id": row["id"],
                "name": row["name"],
                "role": row["role"],
                "notes": row["notes"],
                "connectionCount": row["connectionCount"],
            }
        )
    return result


def get_geocoded_locations() -> list:
    """Return all location nodes with latitude and longitude set."""
    rows = _run_read(
        """
        MATCH (l:Location)
        WHERE l.lat IS NOT NULL AND l.lng IS NOT NULL
        RETURN elementId(l) AS id,
               l.name AS name,
               l.lat AS lat,
               l.lng AS lng,
               l.notes AS notes,
               l.mentions AS mentions
        ORDER BY l.name ASC
        """
    )
    return [dict(row) for row in rows]


def update_location_coordinates(name: str, lat: float, lng: float) -> None:
    """Set latitude and longitude on a location node identified by name."""
    _run_write(
        """
        MATCH (l:Location {name: $name})
        SET l.lat = $lat,
            l.lng = $lng
        """,
        {"name": name, "lat": lat, "lng": lng},
    )


def upsert_relationships(relationships: Iterable[Dict[str, Any]], case_id: Optional[str] = None) -> dict:
    """Create or update relationship records between graph nodes."""
    if relationships is None:
        raise ValueError("relationships must be an iterable of relationship objects")

    count = 0
    with get_driver().session() as session:
        for relation in relationships:
            source_name = (relation.get("source") or relation.get("sourceName") or "").strip()
            target_name = (relation.get("target") or relation.get("targetName") or "").strip()
            if not source_name or not target_name:
                continue

            rel_type = relation.get("type") or "associate"
            description = relation.get("description") or ""

            session.run(
                """
                MATCH (source)
                WHERE source.name = $source_name
                MATCH (target)
                WHERE target.name = $target_name
                MERGE (source)-[r:CONNECTED_TO]->(target)
                ON CREATE SET r.type = $rel_type,
                              r.description = $description,
                              r.caseId = $case_id
                ON MATCH SET r.type = $rel_type,
                             r.description = $description,
                             r.caseId = $case_id
                """,
                {
                    "source_name": source_name,
                    "target_name": target_name,
                    "rel_type": rel_type,
                    "description": description,
                    "case_id": case_id,
                },
            )
            count += 1

    return {"relationships": count}
