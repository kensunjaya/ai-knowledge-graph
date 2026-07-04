#!/usr/bin/env python3
"""
Incremental Knowledge Graph Updater.

This script is the entry point for updating an existing knowledge graph
with new textual information.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.knowledge_graph.incremental import main

if __name__ == "__main__":
    main()