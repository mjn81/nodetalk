.PHONY: help build run dev tidy lint test clean

GO     := go
NPM    := npm
BIN    := nodetalk

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

## Backend targets
tidy: ## Run go mod tidy
	$(GO) mod tidy

build: ## Build the Go server binary
	$(GO) build -o $(BIN) ./cmd/server

run: ## Run the Go server (requires build first or uses go run)
	$(GO) run ./cmd/server

test: ## Run all Go tests
	$(GO) test ./... -race -cover

lint: ## Run golangci-lint (must be installed)
	golangci-lint run ./...

## Frontend targets
frontend/install: ## Install frontend npm dependencies
	cd frontend && $(NPM) install

frontend/dev: ## Start Vite dev server
	cd frontend && $(NPM) run dev

frontend/build: ## Build frontend production bundle
	cd frontend && $(NPM) run build

## Combined
dev: ## Run backend + frontend dev servers concurrently
	@echo "Starting NodeTalk dev environment…"
	@$(MAKE) -j2 run frontend/dev

clean: ## Remove build artifacts and data directory
	rm -f $(BIN)
	rm -rf data/
	rm -rf frontend/dist/
