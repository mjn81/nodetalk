// +build !darwin

package main

// RequestMicrophonePermission is a stub for non-macOS platforms.
func (a *App) RequestMicrophonePermission() {
	// On other platforms, the browser/webview typically handles this automatically
}

// GetMicrophonePermissionStatus is a stub for non-macOS platforms.
func (a *App) GetMicrophonePermissionStatus() int {
	return 3 // Authorized (let the webview handle it)
}
