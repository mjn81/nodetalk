package main

import (
	"fmt"
	"net"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	PacketTypeRegister = 0
	PacketTypeAudio    = 1
	PacketTypeJoin     = 2
	PacketTypeLeave    = 3
	IDLength           = 36
)

type VoiceManager struct {
	app        *App
	conn       *net.UDPConn
	serverAddr *net.UDPAddr
	mu         sync.Mutex
	running    bool
	userID     string
	channelID  string
}

func NewVoiceManager(app *App) *VoiceManager {
	return &VoiceManager{app: app}
}

func (v *VoiceManager) StartVoice(serverHost string, udpPort int, sessionToken string, userID string) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	if v.running {
		return nil
	}

	addr, err := net.ResolveUDPAddr("udp", fmt.Sprintf("%s:%d", serverHost, udpPort))
	if err != nil {
		return err
	}
	v.serverAddr = addr

	conn, err := net.ListenUDP("udp", nil)
	if err != nil {
		return err
	}
	v.conn = conn
	v.userID = userID
	v.running = true

	fmt.Printf(">>> VoiceManager: Starting session for user %s on %s\n", userID, v.serverAddr.String())

	// 1. Register with server
	regPkt := append([]byte{PacketTypeRegister}, []byte(sessionToken)...)
	_, err = v.conn.WriteToUDP(regPkt, v.serverAddr)
	if err != nil {
		fmt.Printf(">>> VoiceManager: FAILED to send Register: %v\n", err)
	} else {
		fmt.Printf(">>> VoiceManager: Sent Register packet to %s\n", v.serverAddr.String())
	}

	// 2. Start listener goroutine
	go v.listen()

	return nil
}

func (v *VoiceManager) listen() {
	buf := make([]byte, 4096)
	fmt.Println(">>> VoiceManager: Listener goroutine started")
	for {
		v.mu.Lock()
		if !v.running {
			v.mu.Unlock()
			return
		}
		conn := v.conn
		v.mu.Unlock()

		n, _, err := conn.ReadFromUDP(buf)
		if err != nil {
			return
		}

		if n < 1 {
			continue
		}

		packetType := buf[0]
		payload := buf[1:n]

		switch packetType {
		case PacketTypeAudio:
			if len(payload) >= IDLength {
				senderID := string(payload[:IDLength])
				senderID = strings.TrimRight(senderID, "\x00")
				audioData := payload[IDLength:]
				fmt.Printf(">>> VoiceManager: Received audio packet (type: %d, sender: %s, len: %d)\n", packetType, senderID, len(audioData))
				if n%100 == 0 {
					fmt.Printf(">>> VoiceManager: Received audio from %s (len: %d)\n", senderID, len(audioData))
				}
				runtime.EventsEmit(v.app.ctx, "voice:audio", map[string]interface{}{
					"senderID": senderID,
					"data":     audioData,
				})
			}
		}
	}
}

func (v *VoiceManager) JoinChannelVoice(channelID string) {
	v.mu.Lock()
	defer v.mu.Unlock()
	if !v.running {
		fmt.Println(">>> VoiceManager: Cannot join, not running")
		return
	}

	v.channelID = channelID
	fmt.Printf(">>> VoiceManager: Joining channel %s\n", channelID)
	joinPkt := append([]byte{PacketTypeJoin}, []byte(channelID)...)
	_, err := v.conn.WriteToUDP(joinPkt, v.serverAddr)
	if err != nil {
		fmt.Printf(">>> VoiceManager: FAILED to send Join: %v\n", err)
	} else {
		fmt.Println(">>> VoiceManager: Join packet sent")
	}
}

func (v *VoiceManager) LeaveChannelVoice() {
	v.mu.Lock()
	v.leaveChannelVoiceInternal()
	v.mu.Unlock()
}

func (v *VoiceManager) leaveChannelVoiceInternal() {
	if !v.running || v.channelID == "" {
		return
	}

	fmt.Printf(">>> VoiceManager: Leaving channel %s\n", v.channelID)
	leavePkt := append([]byte{PacketTypeLeave}, []byte(v.channelID)...)
	_, _ = v.conn.WriteToUDP(leavePkt, v.serverAddr)
	v.channelID = ""
}

func (v *VoiceManager) SendAudio(data []byte) {
	v.mu.Lock()
	defer v.mu.Unlock()
	if !v.running || v.channelID == "" {
		return
	}

	pkt := make([]byte, 1+IDLength+len(data))
	pkt[0] = PacketTypeAudio
	copy(pkt[1:], v.channelID)
	copy(pkt[1+IDLength:], data)

	_, err := v.conn.WriteToUDP(pkt, v.serverAddr)
	if err != nil {
		fmt.Printf(">>> VoiceManager: SendAudio FAILED: %v\n", err)
	}
}

func (v *VoiceManager) StopVoice() {
	v.mu.Lock()
	defer v.mu.Unlock()
	if !v.running {
		return
	}

	fmt.Println(">>> VoiceManager: Stopping session")
	v.leaveChannelVoiceInternal()
	v.running = false
	if v.conn != nil {
		v.conn.Close()
	}
}

// ── App Bindings ─────────────────────────────────────────────────────────────

func (a *App) StartVoiceChat(serverHost string, udpPort int, sessionToken string, userID string) error {
	if a.voiceManager == nil {
		a.voiceManager = NewVoiceManager(a)
	}
	return a.voiceManager.StartVoice(serverHost, udpPort, sessionToken, userID)
}

func (a *App) JoinVoiceChannel(channelID string) {
	if a.voiceManager != nil {
		a.voiceManager.JoinChannelVoice(channelID)
	}
}

func (a *App) LeaveVoiceChannel() {
	if a.voiceManager != nil {
		a.voiceManager.LeaveChannelVoice()
	}
}

func (a *App) SendVoiceAudio(data []byte) {
	if a.voiceManager != nil {
		a.voiceManager.SendAudio(data)
	}
}

func (a *App) StopVoiceChat() {
	if a.voiceManager != nil {
		a.voiceManager.StopVoice()
	}
}
