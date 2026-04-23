package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	wails_runtime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the Wails application struct.
type App struct {
	ctx        context.Context
	backendCmd *exec.Cmd
	apiPort    int
}

// NewApp creates the application struct.
func NewApp() *App {
	return &App{
		apiPort: 8080, // Default backend port
	}
}

// Startup is called when the Wails app starts.
// It launches the backend binary as a child process.
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx

	// Find the backend binary
	// In dev mode: ../nodetalk-server
	// In production: packaged with the app
	exePath, err := os.Executable()
	if err != nil {
		log.Printf("Error getting executable path: %v", err)
	}
	baseDir := filepath.Dir(exePath)

	backendName := "nodetalk-server"
	if runtime.GOOS == "windows" {
		backendName += ".exe"
	}

	// Potential locations for the backend binary
	locations := []string{
		filepath.Join(baseDir, backendName),                 // Same dir as desktop app
		filepath.Join(baseDir, "..", backendName),           // Repo root (dev)
		filepath.Join(baseDir, "..", "..", "..", backendName), // macOS .app bundle structure
	}

	var backendPath string
	for _, loc := range locations {
		if _, err := os.Stat(loc); err == nil {
			backendPath = loc
			break
		}
	}

	if backendPath == "" {
		log.Printf("Warning: backend binary '%s' not found in expected locations. Using PATH.", backendName)
		backendPath = backendName
	}

	log.Printf("Launching backend from: %s", backendPath)

	a.backendCmd = exec.Command(backendPath)
	a.backendCmd.Stdout = os.Stdout
	a.backendCmd.Stderr = os.Stderr

	if err := a.backendCmd.Start(); err != nil {
		log.Printf("Error starting backend: %v", err)
	}
}

// DomReady is called after the frontend DOM is fully loaded.
func (a *App) DomReady(ctx context.Context) {
	// Emit the backend URL. For now we assume the default 8080.
	// In a more robust version, we could wait for the backend to print its port.
	wails_runtime.EventsEmit(ctx, "backend:ready", map[string]any{
		"api_url": fmt.Sprintf("http://127.0.0.1:%d", a.apiPort),
		"ws_url":  fmt.Sprintf("ws://127.0.0.1:%d", a.apiPort),
	})
}

// Shutdown is called when the Wails app is about to exit.
func (a *App) Shutdown(ctx context.Context) {
	if a.backendCmd != nil && a.backendCmd.Process != nil {
		log.Println("Shutting down backend...")
		if err := a.backendCmd.Process.Signal(os.Interrupt); err != nil {
			log.Printf("Error signaling backend: %v", err)
			a.backendCmd.Process.Kill()
		}
		
		// Wait for exit with timeout
		done := make(chan error, 1)
		go func() { done <- a.backendCmd.Wait() }()
		
		select {
		case <-time.After(3 * time.Second):
			log.Println("Backend didn't exit in time, killing.")
			a.backendCmd.Process.Kill()
		case <-done:
			log.Println("Backend exited gracefully.")
		}
	}
}

// ── Exported Go→JS bindings ──────────────────────────────────────────────────

func (a *App) GetAPIURL() string {
	return fmt.Sprintf("http://127.0.0.1:%d", a.apiPort)
}

func (a *App) GetWSURL() string {
	return fmt.Sprintf("ws://127.0.0.1:%d", a.apiPort)
}

func (a *App) AppVersion() string {
	return "0.1.0-dev"
}
