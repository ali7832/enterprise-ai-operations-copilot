.PHONY: test lint run compose-up compose-down

test:
	python -m unittest discover -s tests -p 'test_*.py'

lint:
	python -m py_compile $(shell find app tests scripts -name '*.py')

run:
	python -m app.main

compose-up:
	docker compose up --build

compose-down:
	docker compose down -v

