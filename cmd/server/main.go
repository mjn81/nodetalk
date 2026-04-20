package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"nodetalk/internal/api"
	"nodetalk/internal/auth"
	"nodetalk/internal/config"
	"nodetalk/internal/crypto"
	"nodetalk/internal/db"
	"nodetalk/internal/store"
	"nodetalk/internal/ws"
)

func main() {
	// ── 1. Load configuration ─────────────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("FATAL: config load failed: %v", err)
	}
	log.Printf("NodeTalk starting on %s:%d", cfg.Server.Domain, cfg.Server.HTTPPort)

	// ── 2. Derive Key Encryption Key (KEK) from master password ──────────
	kek := crypto.DeriveKEK(cfg.Security.MasterPassword)

	// ── 3. Bootstrap the Data Encryption Key (DEK) ───────────────────────
	// The meta store is a tiny unencrypted BadgerDB that holds the encrypted DEK.
	metaPath := cfg.Database.Path + "/meta"
	dek, err := db.BootstrapDEK(metaPath, kek)
	if err != nil {
		log.Fatalf("FATAL: DEK bootstrap failed: %v", err)
	}

	// ── 4. Open the main encrypted BadgerDB ──────────────────────────────
	mainPath := cfg.Database.Path + "/main"
	database, err := db.Open(mainPath, dek)
	if err != nil {
		log.Fatalf("FATAL: database open failed: %v", err)
	}
	defer func() {
		if err := database.Close(); err != nil {
			log.Printf("WARNING: database close error: %v", err)
		}
		log.Println("Database closed.")
	}()
	log.Println("Database initialized.")

	// Background GC for BadgerDB value log.
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			_ = database.RunGC()
		}
	}()

	// ── 5. Initialize application layers ─────────────────────────────────
	dataStore := store.New(database)
	sessions := auth.NewSessionStore()

	// ── 6. Wire HTTP API and WebSocket Hub ────────────────────────────────
	uploadDir := "./data/uploads"
	apiHandler := &api.Handler{
		Store:     dataStore,
		Sessions:  sessions,
		KEK:       kek,
		UploadDir: uploadDir,
	}
	wsHub := ws.NewHub(dataStore, sessions, kek)

	// Build root mux: API routes + WebSocket endpoint.
	rootMux := http.NewServeMux()
	rootMux.Handle("/ws", wsHub)
	rootMux.Handle("/", api.NewRouter(apiHandler, float64(cfg.RateLimit.GlobalRPS), float64(cfg.RateLimit.AuthRPS)))

	// ── 7. Start HTTP server ──────────────────────────────────────────────
	addr := fmt.Sprintf(":%d", cfg.Server.HTTPPort)
	srv := &http.Server{
		Addr:         addr,
		Handler:      rootMux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// ── 8. Start UDP Voice Router (if UDP port configured) ────────────────
	if cfg.Server.UDPPort > 0 {
		go startUDPRouter(cfg.Server.UDPPort)
	}

	// ── 9. Graceful shutdown on SIGINT / SIGTERM ──────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("HTTP server listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("FATAL: HTTP server error: %v", err)
		}
	}()

	<-quit
	log.Println("Shutting down gracefully…")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("HTTP server forced shutdown: %v", err)
	}
	log.Println("NodeTalk stopped. Goodbye.")
}

// startUDPRouter opens a raw UDP socket for the Wails desktop voice pipeline.
// Audio packets are routed opaquely — the server never decodes the payload.
func startUDPRouter(port int) {
	addr := &net.UDPAddr{Port: port}
	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		log.Printf("WARNING: UDP voice router failed to bind on port %d: %v", port, err)
		return
	}
	defer conn.Close()
	log.Printf("UDP voice router listening on :%d", port)

	buf := make([]byte, 4096)
	for {
		// Phase 5 (Wails): implement peer routing table and forward packets.
		// For now, echo back to the sender to confirm connectivity.
		n, remoteAddr, err := conn.ReadFromUDP(buf)
		if err != nil {
			log.Printf("UDP read error: %v", err)
			continue
		}
		// TODO(phase5): route buf[:n] to the correct peer based on session token in header.
		_, _ = conn.WriteToUDP(buf[:n], remoteAddr)
	}
}
