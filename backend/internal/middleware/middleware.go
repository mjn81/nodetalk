package middleware

import (
	"bufio"
	"errors"
	"log"
	"net"
	"net/http"
	"strings"
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

// CORS returns a middleware that sets permissive CORS headers and handles preflight requests.
func CORS(next http.Handler, isDev bool, allowedOrigins string) http.Handler {
	// Split allowed origins by comma
	origins := make(map[string]bool)
	allowAll := false
	for _, o := range strings.Split(allowedOrigins, ",") {
		o = strings.TrimSpace(o)
		if o == "*" {
			allowAll = true
		}
		if o != "" {
			origins[o] = true
		}
	}

	// Always allow Wails desktop app origins
	origins["wails://wails.localhost"] = true // macOS/Linux
	origins["http://wails.localhost"] = true  // Windows
	origins["http://localhost:34115"] = true  // Wails dev mode default

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		
		// 1. Explicitly handle the Origin header
		if allowAll {
			if origin != "" {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			} else {
				w.Header().Set("Access-Control-Allow-Origin", "*")
			}
		} else if origins[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else if isDev {
			// Fallback for development if no origin is configured or mismatch
			if origin != "" {
				// Log the mismatch to help with debugging
				if allowedOrigins != "" {
					log.Printf("CORS: Origin mismatch. Got %q, expected one of %q. Falling back to echoing origin in Dev mode.", origin, allowedOrigins)
				}
				w.Header().Set("Access-Control-Allow-Origin", origin)
			} else {
				w.Header().Set("Access-Control-Allow-Origin", "*")
			}
		} else if origin != "" {
			// Production mismatch logging
			log.Printf("CORS: REJECTED origin %q. Not in allowed list: %q", origin, allowedOrigins)
		}

		// 2. Set mandatory CORS headers
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		
		// 3. Handle allowed headers (Content-Type, Authorization, and any requested headers)
		requestedHeaders := r.Header.Get("Access-Control-Request-Headers")
		if requestedHeaders != "" {
			w.Header().Set("Access-Control-Allow-Headers", requestedHeaders)
		} else {
			w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, Authorization, X-CSRF-Token")
		}

		// 4. Intercept and Terminate OPTIONS (Preflight) requests
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		// 5. Continue for actual requests
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
