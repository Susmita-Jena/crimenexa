from flask import Flask, jsonify, request
from flask_cors import CORS

from config import load_config
from services.graph_db import (
    get_geocoded_locations,
    get_graph,
    get_people_ranked,
    upsert_entities,
    upsert_relationships,
)

load_config()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})


@app.get("/api/health")
def health_check():
    return jsonify({"status": "ok", "service": "python_graph_service"})


@app.post("/api/graph/entities")
def graph_entities():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    entity_payload = payload.get("entities") if isinstance(payload.get("entities"), dict) else payload
    if not isinstance(entity_payload, dict):
        return jsonify({"error": "Invalid entity payload. Expected an object with an 'entities' field."}), 400

    if not entity_payload.get("people") and not entity_payload.get("locations") and not entity_payload.get("organizations") and not entity_payload.get("vehicles") and not entity_payload.get("phones"):
        return jsonify({"error": "No entities were provided to upsert."}), 400

    case_id = payload.get("caseId") or payload.get("case_id")

    try:
        result = upsert_entities(entity_payload, case_id)
        return jsonify({"ok": True, "caseId": case_id, "result": result})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception:
        return jsonify({"error": "Failed to write graph entities."}), 503


@app.post("/api/graph/relationships")
def graph_relationships():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    relationships = payload.get("relationships")
    if not isinstance(relationships, list) or not relationships:
        return jsonify({"error": "A non-empty 'relationships' array is required."}), 400

    cleaned = []
    for index, relation in enumerate(relationships):
        if not isinstance(relation, dict):
            return jsonify({"error": f"Relationship at index {index} is not an object."}), 400

        source_name = (relation.get("source") or relation.get("sourceName") or "").strip()
        target_name = (relation.get("target") or relation.get("targetName") or "").strip()
        relation_type = relation.get("type") or "associate"
        description = relation.get("description") or ""

        if not source_name or not target_name:
            return jsonify({"error": f"Relationship at index {index} is missing source or target."}), 400

        cleaned.append({
            "source": source_name,
            "target": target_name,
            "type": relation_type,
            "description": description,
        })

    case_id = payload.get("caseId") or payload.get("case_id")

    try:
        result = upsert_relationships(cleaned, case_id)
        return jsonify({"ok": True, "caseId": case_id, "result": result})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception:
        return jsonify({"error": "Failed to write graph relationships."}), 503


@app.get("/api/graph")
def graph_data():
    try:
        return jsonify(get_graph())
    except Exception:
        return jsonify({"error": "Failed to load graph data."}), 503


@app.get("/api/graph/people")
def graph_people():
    try:
        return jsonify({"people": get_people_ranked()})
    except Exception:
        return jsonify({"error": "Failed to load ranked people."}), 503


@app.get("/api/graph/locations")
def graph_locations():
    try:
        return jsonify({"locations": get_geocoded_locations()})
    except Exception:
        return jsonify({"error": "Failed to load location data."}), 503


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
