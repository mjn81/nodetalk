package config

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"

	"github.com/BurntSushi/toml"
)

// Config holds all server configuration values.
type Config struct {
	Server    ServerConfig    `toml:"server"`
	Security  SecurityConfig  `toml:"security"`
	Database  DatabaseConfig  `toml:"database"`
	RateLimit RateLimitConfig `toml:"rate_limit"`
}

type ServerConfig struct {
	Domain   string `toml:"domain"`
	HTTPPort int    `toml:"http_port"`
	UDPPort  int    `toml:"udp_port"`
}

type SecurityConfig struct {
	MasterPassword string `toml:"master_password"`
}

type DatabaseConfig struct {
	Path string `toml:"path"`
}

type RateLimitConfig struct {
	GlobalRPS int `toml:"global_rps"`
	AuthRPS   int `toml:"auth_rps"`
}

const configPath = "config.toml"

// Load reads config.toml, applying defaults where values are missing.
// If a master_password is not set, it generates one, prints it to the terminal,
// and persists it back into config.toml.
func Load() (*Config, error) {
	cfg := &Config{
		Server: ServerConfig{
			Domain:   "localhost",
			HTTPPort: 8080,
			UDPPort:  9090,
		},
		Security: SecurityConfig{
			MasterPassword: "",
		},
		Database: DatabaseConfig{
			Path: "./data/db",
		},
		RateLimit: RateLimitConfig{
			GlobalRPS: 100,
			AuthRPS:   5,
		},
	}

	// Allow config path to be overridden via environment variable.
	path := configPath
	if envPath := os.Getenv("NODETALK_CONFIG"); envPath != "" {
		path = envPath
	}

	if _, err := toml.DecodeFile(path, cfg); err != nil && !os.IsNotExist(err) {
		return nil, fmt.Errorf("config: failed to decode %s: %w", path, err)
	}

	// Override master password from environment if set (12-Factor App pattern).
	if envPwd := os.Getenv("NODETALK_MASTER_PASSWORD"); envPwd != "" {
		cfg.Security.MasterPassword = envPwd
	}

	// If still unset, generate a secure random password and persist it.
	if cfg.Security.MasterPassword == "" {
		pwd, err := generateMasterPassword()
		if err != nil {
			return nil, fmt.Errorf("config: failed to generate master password: %w", err)
		}
		cfg.Security.MasterPassword = pwd
		printPasswordWarning(pwd)
		if err := cfg.persist(path); err != nil {
			// Non-fatal — just warn, the server can still run.
			fmt.Fprintf(os.Stderr, "WARNING: Could not persist master password to %s: %v\n", path, err)
			fmt.Fprintln(os.Stderr, "Store the password shown above manually in config.toml or NODETALK_MASTER_PASSWORD.")
		}
	}

	return cfg, nil
}

// generateMasterPassword creates a cryptographically secure 32-byte random
// string encoded as URL-safe Base64.
func generateMasterPassword() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// printPasswordWarning prints the generated master password to the terminal
// in a highly visible format so the operator cannot miss it.
func printPasswordWarning(pwd string) {
	border := "================================================================"
	fmt.Println()
	fmt.Println(border)
	fmt.Println("  !!  NODETALK: MASTER PASSWORD GENERATED — ACTION REQUIRED  !!")
	fmt.Println(border)
	fmt.Printf("  Password: %s\n", pwd)
	fmt.Println()
	fmt.Println("  This password has been saved to config.toml.")
	fmt.Println("  BACK IT UP. Losing it makes the database UNRECOVERABLE.")
	fmt.Println(border)
	fmt.Println()
}

// persist writes the current configuration back to the TOML file.
func (c *Config) persist(path string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return toml.NewEncoder(f).Encode(c)
}
