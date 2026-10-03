PYTHON ?= python3.11
VENV   ?= .venv
BIN    := $(VENV)/bin
PORT   ?= 8790

.PHONY: setup test lint run run-synthetic docker-build docker-run clean

$(BIN)/activate:
	$(PYTHON) -m venv $(VENV)
	$(BIN)/pip install --upgrade pip
	$(BIN)/pip install -r requirements.txt -r requirements-dev.txt

setup: $(BIN)/activate

lint: setup
	$(BIN)/ruff check .

test: setup lint
	$(BIN)/pytest

run: setup
	$(BIN)/uvicorn skycast_ai.app:app --host 0.0.0.0 --port $(PORT)

run-synthetic: setup
	DATA_MODE=synthetic $(BIN)/uvicorn skycast_ai.app:app --host 0.0.0.0 --port $(PORT)

docker-build:
	docker build -t skycast-ai .

docker-run:
	docker run --rm -p $(PORT):8790 -e DATA_MODE=auto -v skycast-ai-data:/data skycast-ai

clean:
	rm -rf .cache .models .pytest_cache .ruff_cache
	find . -name __pycache__ -type d -prune -exec rm -rf {} +
