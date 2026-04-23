.PHONY: help build run dev wails/dev wails/build wails/build/mac swagger test tidy lint clean

GOBIN := $(HOME)/go/bin
GO    := go
NPM   := npm
BIN   := nodetalk-server

help: ## Show this help
	@grep -E '^[a-zA-Z_/-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

## ── Backend ──────────────────────────────────────────────────────────────────
tidy: ## go mod tidy
	cd backend && $(GO) mod tidy

build: ## Build standalone web server binary
	cd backend && $(GO) build -o ../$(BIN) ./cmd/server

run: ## Run standalone web server (go run)
	cd backend && $(GO) run ./cmd/server

test: ## Run all tests with race detector
	cd backend && $(GO) test ./... -race -cover -count=1

lint: ## Run golangci-lint
	cd backend && golangci-lint run ./...

swagger: ## Regenerate Swagger docs (requires swag in GOBIN)
	cd backend && $(GOBIN)/swag init -g cmd/server/main.go --output docs --parseDependency

## ── Frontend ─────────────────────────────────────────────────────────────────
front/install: ## npm install
	$(NPM) --prefix client-web install

front/dev: ## Vite dev server
	$(NPM) --prefix client-web run dev

front/build: ## Build production bundle into client-web/dist/
	$(NPM) --prefix client-web run build

## ── Wails Desktop (PRIMARY build target) ────────────────────────────────────
wails/dev: build ## Run Wails in dev mode (hot-reload desktop app)
	rm -rf client-desktop/frontend/dist
	mkdir -p client-desktop/frontend/dist
	cp -r client-web/dist/* client-desktop/frontend/dist/
	cd client-desktop && $(GOBIN)/wails dev -s

wails/build: build front/build ## Build production Wails desktop binary
	rm -rf client-desktop/frontend/dist
	mkdir -p client-desktop/frontend/dist
	cp -r client-web/dist/* client-desktop/frontend/dist/
	cd client-desktop && $(GOBIN)/wails build -clean -s

wails/build/mac: build front/build ## Build macOS universal binary
	rm -rf client-desktop/frontend/dist
	mkdir -p client-desktop/frontend/dist
	cp -r client-web/dist/* client-desktop/frontend/dist/
	cd client-desktop && $(GOBIN)/wails build -clean -platform darwin/universal -s

## ── Combined ─────────────────────────────────────────────────────────────────
dev: ## Run standalone backend + Vite concurrently (web mode)
	@$(MAKE) -j2 run front/dev

clean: ## Remove build artifacts and temp data
	rm -f $(BIN)
	rm -rf backend/data/db/* backend/data/uploads/* client-web/dist/ client-desktop/build/bin/
