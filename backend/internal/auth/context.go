package auth

import "context"

// contextKey is an unexported type for context keys scoped to this package.
type contextKey int

const sessionKey contextKey = 0

// withSession returns a new context carrying the session.
func withSession(ctx context.Context, s *Session) context.Context {
	return context.WithValue(ctx, sessionKey, s)
}

// SessionFromContext retrieves the session from a request context.
// Returns nil if no session is present.
func SessionFromContext(ctx context.Context) *Session {
	s, _ := ctx.Value(sessionKey).(*Session)
	return s
}
