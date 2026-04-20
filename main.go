// NodeTalk Wails Desktop Application
// This is the primary entry point for the desktop build.
// See cmd/server/main.go for the standalone web server entry point.
package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

// frontend/dist is embedded at build time via `wails build`.
// During development, Wails proxies to the Vite dev server (see wails.json).
//
//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:            "NodeTalk",
		Width:            1280,
		Height:           820,
		MinWidth:         800,
		MinHeight:        600,
		BackgroundColour: &options.RGBA{R: 13, G: 14, B: 20, A: 255},

		AssetServer: &assetserver.Options{
			Assets: assets,
		},

		// Lifecycle hooks
		OnStartup:  app.Startup,
		OnShutdown: app.Shutdown,
		OnDomReady: app.DomReady,

		// Expose App struct methods to the frontend via window.go.*
		Bind: []any{app},

		// macOS specific
		Mac: &mac.Options{
			TitleBar: &mac.TitleBar{
				TitlebarAppearsTransparent: true,
				HideTitle:                  true,
				HideToolbarSeparator:       true,
				FullSizeContent:            true,
			},
			WebviewIsTransparent: true,
			WindowIsTranslucent:  true,
		},
	})
	if err != nil {
		log.Fatalf("Wails run error: %v", err)
	}
}
