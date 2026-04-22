package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"nodetalk/internal/api"
	"nodetalk/internal/auth"
	"nodetalk/internal/config"
	"nodetalk/internal/crypto"
	"nodetalk/internal/db"
	"nodetalk/internal/storage"
	"nodetalk/internal/store"
	"nodetalk/internal/ws"
	"nodetalk/internal/middleware"
)

// App is the Wails application struct. Its exported methods are automatically
// bound to the frontend JavaScript runtime as window.go.<MethodName>().
type App struct {
	ctx      context.Context
	srv      *http.Server
	database *db.DB
	store    *store.Store
	sessions *auth.SessionStore
	hub      *ws.Hub
	kek      []byte
	cfg      *config.Config
	apiPort  int
}

// NewApp creates the application struct. Called before Wails starts.
func NewApp() *App {
	return &App{}
}

// Startup is called when the Wails app starts. Boots the full NodeTalk backend
// on a random available port and connects the frontend to it.
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx

	// ── Load config ──────────────────────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("App.Startup: config load failed: %v", err)
	}
	a.cfg = cfg

	// ── Derive KEK ───────────────────────────────────────────────────────
	a.kek = crypto.DeriveKEK(cfg.Security.MasterPassword)

	// ── Bootstrap DEK ────────────────────────────────────────────────────
	metaPath := cfg.Database.Path + "/meta"
	dek, err := db.BootstrapDEK(metaPath, a.kek)
	if err != nil {
		log.Fatalf("App.Startup: DEK bootstrap failed: %v", err)
	}

	// ── Open BadgerDB ─────────────────────────────────────────────────────
	mainPath := cfg.Database.Path + "/main"
	database, err := db.Open(mainPath, dek)
	if err != nil {
		log.Fatalf("App.Startup: database open failed: %v", err)
	}
	a.database = database
	log.Println("[nodetalk] Database ready")

	// Background GC
	go func() {
		t := time.NewTicker(5 * time.Minute)
		defer t.Stop()
		for range t.C {
			_ = database.RunGC()
		}
	}()

	tokenTTL := time.Duration(cfg.Security.TokenExpireHours) * time.Hour
	a.store = store.New(database)
	a.sessions = auth.NewSessionStore(tokenTTL)
	a.hub = ws.NewHub(a.store, a.sessions, a.kek)

	// ── HTTP server on random available port ───────────────────────────────
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		log.Fatalf("App.Startup: cannot bind HTTP port: %v", err)
	}
	a.apiPort = listener.Addr().(*net.TCPAddr).Port
	log.Printf("[nodetalk] Backend listening on 127.0.0.1:%d", a.apiPort)

	var blobStorage storage.BlobStorage
	if cfg.Storage.S3 != nil && cfg.Storage.S3.Enabled {
		blobStorage = &storage.FileSystemStorage{BaseDir: cfg.Storage.UploadDir}
	} else {
		blobStorage = &storage.FileSystemStorage{BaseDir: cfg.Storage.UploadDir}
	}

	apiHandler := &api.Handler{
		Store:         a.store,
		Sessions:      a.sessions,
		Hub:           a.hub,
		KEK:           a.kek,
		Storage:       blobStorage,
		TokenTTL:      tokenTTL,
		MaxFileSizeMB: cfg.Server.MaxFileSizeMB,
	}

	rootMux := http.NewServeMux()
	rootMux.Handle("/ws", a.hub)
	rootMux.Handle("/", api.NewRouter(apiHandler, float64(cfg.RateLimit.GlobalRPS), float64(cfg.RateLimit.AuthRPS)))

	a.srv = &http.Server{
		Handler:      middleware.Logger(rootMux),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
	}
	go func() {
		if err := a.srv.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Printf("[nodetalk] HTTP server error: %v", err)
		}
	}()
}

// DomReady is called after the frontend DOM is fully loaded.
// We emit the backend API URL so React can connect to the right port.
func (a *App) DomReady(ctx context.Context) {
	runtime.EventsEmit(ctx, "backend:ready", map[string]any{
		"api_url": fmt.Sprintf("http://127.0.0.1:%d", a.apiPort),
		"ws_url":  fmt.Sprintf("ws://127.0.0.1:%d", a.apiPort),
	})
}

// Shutdown is called when the Wails app is about to exit.
// Gracefully stops the HTTP server and closes the database.
func (a *App) Shutdown(ctx context.Context) {
	shutCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if a.srv != nil {
		if err := a.srv.Shutdown(shutCtx); err != nil {
			log.Printf("[nodetalk] HTTP shutdown error: %v", err)
		}
	}
	if a.database != nil {
		if err := a.database.Close(); err != nil {
			log.Printf("[nodetalk] DB close error: %v", err)
		}
	}
	log.Println("[nodetalk] Shutdown complete")
}

// ── Exported Go→JS bindings ──────────────────────────────────────────────────
// These are optional helpers that let the frontend call Go functions directly.
// The primary communication is still the REST API + WebSocket.

// GetAPIURL returns the backend API base URL for the embedded frontend.
// Used during Wails dev mode where the URL isn't known at compile time.
func (a *App) GetAPIURL() string {
	return fmt.Sprintf("http://127.0.0.1:%d", a.apiPort)
}

// GetWSURL returns the WebSocket URL for the embedded frontend.
func (a *App) GetWSURL() string {
	return fmt.Sprintf("ws://127.0.0.1:%d", a.apiPort)
}

// AppVersion returns the application version string.
func (a *App) AppVersion() string {
	return "0.1.0-dev"
}
