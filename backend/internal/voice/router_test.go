package voice

import (
	"net"
	"testing"
	"time"
	"nodetalk/backend/internal/auth"
)

func TestVoiceRouter_ChannelSession(t *testing.T) {
	// 1. Setup SessionStore
	sessions := auth.NewSessionStore(1 * time.Hour)
	user1ID := "user1-36-chars-uuid-mock-id-value!!!"
	user2ID := "user2-36-chars-uuid-mock-id-value!!!"
	user3ID := "user3-36-chars-uuid-mock-id-value!!!"
	token1, _ := sessions.Create(user1ID, "user1")
	token2, _ := sessions.Create(user2ID, "user2")
	token3, _ := sessions.Create(user3ID, "user3")

	// 2. Setup Router
	router := NewRouter(sessions, nil)

	// 3. Setup UDP listener
	addr := &net.UDPAddr{IP: net.ParseIP("127.0.0.1"), Port: 0}
	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		t.Fatalf("failed to listen: %v", err)
	}
	defer conn.Close()
	
	serverAddr := conn.LocalAddr().(*net.UDPAddr)
	go router.HandleConn(conn)

	// 4. Setup Clients
	dial := func() *net.UDPConn {
		c, err := net.DialUDP("udp", nil, serverAddr)
		if err != nil { t.Fatalf("dial failed: %v", err) }
		return c
	}
	c1 := dial(); defer c1.Close()
	c2 := dial(); defer c2.Close()
	c3 := dial(); defer c3.Close()

	// 5. Register & Join Channel
	channelID := "channel-36-chars-uuid-mock-id-value!!"
	
	registerAndJoin := func(c *net.UDPConn, token string) {
		c.Write(append([]byte{PacketTypeRegister}, []byte(token)...))
		time.Sleep(10 * time.Millisecond)
		c.Write(append([]byte{PacketTypeJoin}, []byte(channelID)...))
		time.Sleep(10 * time.Millisecond)
	}

	registerAndJoin(c1, token1)
	registerAndJoin(c2, token2)
	registerAndJoin(c3, token3)

	// 6. Test Broadcasting
	audioPayload := []byte("hello-channel")
	
	// C1 sends audio to the channel
	pkt := append([]byte{PacketTypeAudio}, []byte(channelID)...)
	pkt = append(pkt, audioPayload...)
	c1.Write(pkt)

	// C2 and C3 should receive the audio
	verifyReceive := func(c *net.UDPConn, expectedSender string) {
		buf := make([]byte, 1024)
		c.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
		n, _, err := c.ReadFromUDP(buf)
		if err != nil {
			t.Fatalf("client failed to receive audio: %v", err)
		}
		if buf[0] != PacketTypeAudio {
			t.Errorf("expected PacketTypeAudio, got %d", buf[0])
		}
		senderID := string(buf[1 : 1+IDLength])
		if senderID != expectedSender {
			t.Errorf("expected senderID %s, got %s", expectedSender, senderID)
		}
		receivedAudio := buf[1+IDLength : n]
		if string(receivedAudio) != string(audioPayload) {
			t.Errorf("expected audio %s, got %s", string(audioPayload), string(receivedAudio))
		}
	}

	verifyReceive(c2, user1ID)
	verifyReceive(c3, user1ID)

	// 7. Test Leave
	c2.Write(append([]byte{PacketTypeLeave}, []byte(channelID)...))
	time.Sleep(10 * time.Millisecond)

	c1.Write(pkt) // C1 sends audio again

	// C3 should still receive it
	verifyReceive(c3, user1ID)

	// C2 should NOT receive it (timeout)
	c2.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
	_, _, err = c2.ReadFromUDP(make([]byte, 1024))
	if err == nil {
		t.Error("C2 received audio after leaving channel")
	}
}
