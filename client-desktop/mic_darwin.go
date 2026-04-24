// +build darwin

package main

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework AVFoundation -framework Foundation
#import <AVFoundation/AVFoundation.h>
#import <Foundation/Foundation.h>

void RequestMicPermission() {
    if (@available(macOS 10.14, *)) {
        AVAuthorizationStatus status = [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeAudio];
        if (status == AVAuthorizationStatusNotDetermined) {
            [AVCaptureDevice requestAccessForMediaType:AVMediaTypeAudio completionHandler:^(BOOL granted) {
                // Completion handler
            }];
        }
    }
}

int GetMicPermissionStatus() {
    if (@available(macOS 10.14, *)) {
        return (int)[AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeAudio];
    }
    return 3; // AVAuthorizationStatusAuthorized
}
*/
import "C"
import "log"

// RequestMicrophonePermission triggers the macOS system permission dialog for the microphone.
func (a *App) RequestMicrophonePermission() {
	log.Printf("MicPermission: Requesting microphone permission")
	C.RequestMicPermission()
}

// GetMicrophonePermissionStatus returns the current authorization status:
// 0: NotDetermined, 1: Restricted, 2: Denied, 3: Authorized
func (a *App) GetMicrophonePermissionStatus() int {
	status := int(C.GetMicPermissionStatus())
	log.Printf("MicPermission: Current status is %d", status)
	return status
}
