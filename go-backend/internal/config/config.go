package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	AppName         string
	AppEnv          string
	AppHost         string
	AppPort         string
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	ShutdownTimeout time.Duration

	WhatsAppDashboardURL   string
	WhatsAppAPIUsername    string
	WhatsAppAPIPassword    string
	WhatsAppWebhookSecret  string
	VerifyWebhookSignature bool

	DBHost     string
	DBPort     string
	DBName     string
	DBUser     string
	DBPassword string
	DBParams   string
}

func (c Config) Address() string {
	return fmt.Sprintf("%s:%s", c.AppHost, c.AppPort)
}

func Load() (Config, error) {
	cfg := Config{
		AppName:         getEnv("APP_NAME", "posbengkel-go"),
		AppEnv:          getEnv("APP_ENV", "local"),
		AppHost:         getEnv("APP_HOST", "0.0.0.0"),
		AppPort:         getEnv("APP_PORT", "8081"),
		ReadTimeout:     getDurationEnv("READ_TIMEOUT", 10*time.Second),
		WriteTimeout:    getDurationEnv("WRITE_TIMEOUT", 10*time.Second),
		ShutdownTimeout: getDurationEnv("SHUTDOWN_TIMEOUT", 10*time.Second),

		WhatsAppDashboardURL:   getEnv("WHATSAPP_GO_DASHBOARD_URL", ""),
		WhatsAppAPIUsername:    getEnv("WHATSAPP_API_USERNAME", ""),
		WhatsAppAPIPassword:    getEnv("WHATSAPP_API_PASSWORD", ""),
		WhatsAppWebhookSecret:  getEnv("WHATSAPP_WEBHOOK_SECRET", "secret"),
		VerifyWebhookSignature: getBoolEnv("WHATSAPP_WEBHOOK_VERIFY_SIGNATURE", true),

		DBHost:     getEnv("DB_HOST", "127.0.0.1"),
		DBPort:     getEnv("DB_PORT", "3306"),
		DBName:     getEnv("DB_DATABASE", ""),
		DBUser:     getEnv("DB_USERNAME", ""),
		DBPassword: getEnv("DB_PASSWORD", ""),
		DBParams:   getEnv("DB_PARAMS", "parseTime=true&charset=utf8mb4&loc=Local"),
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getDurationEnv(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}

	d, err := time.ParseDuration(v)
	if err != nil {
		return fallback
	}

	return d
}

func getBoolEnv(key string, fallback bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}

	b, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}

	return b
}
