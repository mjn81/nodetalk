.PHONY: help build run dev wails/dev wails/build wails/build/mac swagger test tidy lint clean

GOBIN := $(HOME)/go/bin
GO    := go
NPM   := npm
BIN   := nodetalk-server

help: ## Show this help
	@grep -E '^[a-zA-Z_/-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

## ── Backend ──────────────────────────────────────────────────────────────────
tidy: ## go mod tidy
	$(GO) mod tidy

build: ## Build standalone web server binary
	$(GO) build -o $(BIN) ./cmd/server

run: ## Run standalone web server (go run)
	$(GO) run ./cmd/server

test: ## Run all tests with race detector
	$(GO) test ./... -race -cover -count=1

lint: ## Run golangci-lint
	golangci-lint run ./...

swagger: ## Regenerate Swagger docs (requires swag in GOBIN)
	$(GOBIN)/swag init -g cmd/server/main.go --output docs --parseDependency

## ── Frontend ─────────────────────────────────────────────────────────────────
front/install: ## npm install
	cd frontend && $(NPM) install

front/dev: ## Vite dev server
	cd frontend && $(NPM) run dev

front/build: ## Build production bundle into frontend/dist/
	cd frontend && $(NPM) run build

## ── Wails Desktop (PRIMARY build target) ────────────────────────────────────
wails/dev: ## Run Wails in dev mode (hot-reload desktop app)
	$(GOBIN)/wails dev

wails/build: ## Build production Wails desktop binary
	$(GOBIN)/wails build -clean

wails/build/mac: ## Build macOS universal binary
	$(GOBIN)/wails build -clean -platform darwin/universal

## ── Combined ─────────────────────────────────────────────────────────────────
dev: ## Run standalone backend + Vite concurrently (web mode)
	@$(MAKE) -j2 run frontend/dev

clean: ## Remove build artifacts and temp data
	rm -f $(BIN)
	rm -rf data/ frontend/dist/ build/bin/
