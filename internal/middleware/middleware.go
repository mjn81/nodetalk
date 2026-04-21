package middleware

import (
	"bufio"
	"errors"
	"log"
	"net"
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// responseWriter is a wrapper for http.ResponseWriter to capture status code.
type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	h, ok := rw.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, errors.New("http.Hijacker not implemented")
	}
	return h.Hijack()
}

func (rw *responseWriter) Flush() {
	if f, ok := rw.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// Logger returns a middleware that logs incoming requests.
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{w, http.StatusOK}

		next.ServeHTTP(rw, r)

		duration := time.Since(start)
		log.Printf(
			"[%s] %s %s | %d | %v",
			r.Method,
			r.URL.Path,
			realIP(r),
			rw.status,
			duration,
		)
	})
}

// ipLimiter stores a per-IP rate limiter.
type ipLimiter struct {
	limiter *rate.Limiter
}

// RateLimiter holds limiters per IP and supports different per-route limits.
type RateLimiter struct {
	mu      sync.Mutex
	clients map[string]*ipLimiter
	rps     rate.Limit
	burst   int
}

// NewRateLimiter creates a new RateLimiter with the given requests-per-second
// and burst allowance.
func NewRateLimiter(rps float64, burst int) *RateLimiter {
	return &RateLimiter{
		clients: make(map[string]*ipLimiter),
		rps:     rate.Limit(rps),
		burst:   burst,
	}
}

// getLimiter returns the rate limiter for the given IP, creating one if needed.
func (rl *RateLimiter) getLimiter(ip string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	if l, ok := rl.clients[ip]; ok {
		return l.limiter
	}
	l := &ipLimiter{limiter: rate.NewLimiter(rl.rps, rl.burst)}
	rl.clients[ip] = l
	return l.limiter
}

// Limit returns an HTTP middleware that enforces rate limiting per client IP.
func (rl *RateLimiter) Limit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := realIP(r)
		if !rl.getLimiter(ip).Allow() {
			http.Error(w, `{"error":"rate limit exceeded"}`, http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// realIP extracts the actual client IP, respecting common proxy headers.
func realIP(r *http.Request) string {
	if ip := r.Header.Get("CF-Connecting-IP"); ip != "" {
		return ip
	}
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		// X-Forwarded-For can be comma-separated; take the first.
		for i := 0; i < len(ip); i++ {
			if ip[i] == ',' {
				return ip[:i]
			}
		}
		return ip
	}
	// Fall back to r.RemoteAddr (strips port).
	host := r.RemoteAddr
	for i := len(host) - 1; i >= 0; i-- {
		if host[i] == ':' {
			return host[:i]
		}
	}
	return host
}

// CORS returns a middleware that sets permissive CORS headers, suitable for
// local dev. Tighten AllowedOrigins for production.
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// JSON sets the Content-Type to application/json for all responses.
func JSON(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		next.ServeHTTP(w, r)
	})
}
