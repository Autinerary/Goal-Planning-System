#!/bin/bash
# Helper script to activate the virtual environment
source venv/bin/activate
echo "✓ Virtual environment activated"
echo "Python: $(which python)"
echo "FastAPI: $(python -c 'import fastapi; print(fastapi.__version__)')"
echo "Pydantic: $(python -c 'import pydantic; print(pydantic.__version__)')"
