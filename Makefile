PYTHON ?= python3

.PHONY: bootstrap dev test train
bootstrap:
	$(PYTHON) scripts/bootstrap.py
dev:
	$(PYTHON) scripts/dev.py
test:
	$(PYTHON) scripts/verify.py
train:
	.venv/bin/python scripts/train_baseline.py --demo
