"""
Database handler for database-backed Knowledge Graph processing.
Provides utilities for connecting to SQL Server, loading requests,
managing status updates, and saving KG results.
"""
import pymssql
import uuid
import datetime
import os
import json
from src.knowledge_graph.config import load_config

def get_connection():
    """
    Establish a connection to the SQL Server database.
    Reads database configuration from config.toml.
    """
    # Assuming config.toml is in the current working directory or project root
    config = load_config("config.toml")
    if not config or "database" not in config:
        raise ValueError("Database configuration not found in config.toml")
        
    db_config = config["database"]
    return pymssql.connect(
        server=db_config["DB_SERVER"],
        port=int(db_config.get("DB_PORT", 1433)),
        user=db_config["DB_USER"],
        password=db_config["DB_PASSWORD"],
        database=db_config["DB_NAME"]
    )

def get_request_details(request_id):
    """
    Query TBL_USER_REQUEST and TBL_RAW_TEXT to fetch request type,
    title, target graph ID, and raw text.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor(as_dict=True)
        # Select request details
        cursor.execute(
            "SELECT intId, strTitle, strRequestType, strStatus, intTargetKgId "
            "FROM dbo.TBL_USER_REQUEST WHERE intId = %s",
            (request_id,)
        )
        request = cursor.fetchone()
        if not request:
            raise ValueError(f"Request with ID {request_id} not found.")
            
        # Select raw text
        cursor.execute(
            "SELECT strRawText FROM dbo.TBL_RAW_TEXT WHERE intUserRequestId = %s",
            (request_id,)
        )
        raw_text_row = cursor.fetchone()
        if not raw_text_row:
            raise ValueError(f"Raw text for request ID {request_id} not found.")
            
        request["strRawText"] = raw_text_row["strRawText"]
        return request
    finally:
        conn.close()

def update_request_status(request_id, status, error_message=None, start_time=False, end_time=False):
    """
    Update request status, error message, and timestamps in TBL_USER_REQUEST.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        now = datetime.datetime.now()
        
        updates = ["strStatus = %s"]
        params = [status]
        
        if error_message is not None:
            updates.append("strErrorMessage = %s")
            params.append(error_message)
        else:
            updates.append("strErrorMessage = NULL")
            
        if start_time:
            updates.append("dtStartedAt = %s")
            params.append(now)
            
        if end_time:
            updates.append("dtCompletedAt = %s")
            params.append(now)
            
        params.append(request_id)
        sql = f"UPDATE dbo.TBL_USER_REQUEST SET {', '.join(updates)} WHERE intId = %s"
        cursor.execute(sql, tuple(params))
        conn.commit()
    finally:
        conn.close()

def get_latest_kg_result(graph_id):
    """
    Get the latest result (highest version) for a given graph ID.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor(as_dict=True)
        cursor.execute(
            "SELECT intId, intGraphId, strName, strGraphJson, intVersion "
            "FROM dbo.TBL_KG_RESULT "
            "WHERE intGraphId = %s "
            "ORDER BY intVersion DESC",
            (graph_id,)
        )
        row = cursor.fetchone()
        return row
    finally:
        conn.close()

def save_kg_result(request_id, graph_id, name, graph_json, graph_html, changeset_json, version):
    """
    Save a new KG result to TBL_KG_RESULT.
    Uses UUIDs for primary keys.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        result_id = str(uuid.uuid4())
        now = datetime.datetime.now()
        
        cursor.execute(
            "INSERT INTO dbo.TBL_KG_RESULT ("
            "    intId, intUserRequestId, intGraphId, strName, "
            "    strGraphJson, strGraphHtml, strChangeSetJson, intVersion, "
            "    dtCreatedAt, dtUpdatedAt"
            ") VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (
                result_id, request_id, graph_id, name,
                graph_json, graph_html, changeset_json, version,
                now, now
            )
        )
        conn.commit()
        return result_id
    finally:
        conn.close()
