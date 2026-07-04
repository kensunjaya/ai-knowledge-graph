#!/usr/bin/env python3
"""
Incremental Knowledge Graph Updater.
This script serves as a backward-compatible entry point to the incremental update pipeline.
"""
import sys
import os

# Add the current directory to the path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from src.knowledge_graph.incremental import main

if __name__ == "__main__":
    main()
