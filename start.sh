#!/bin/bash
cd "$(dirname "$0")"
pip install -r requirements.txt
python3 -m uvicorn server:app --host 0.0.0.0 --port 5006
