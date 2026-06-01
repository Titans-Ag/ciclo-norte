package evolution

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Client sends messages via Evolution API v2.
type Client struct {
	BaseURL string
	APIKey  string
	HTTP    *http.Client
}

// NewClient creates a new Evolution client.
func NewClient(baseURL, apiKey string) *Client {
	if baseURL == "" {
		baseURL = "http://localhost:8080"
	}
	return &Client{
		BaseURL: baseURL,
		APIKey:  apiKey,
		HTTP:    &http.Client{Timeout: 30 * time.Second},
	}
}

// SendTextMessage sends a text message to a number via an instance.
func (c *Client) SendTextMessage(ctx context.Context, instanceName, toNumber, text string) error {
	url := fmt.Sprintf("%s/message/sendText/%s", c.BaseURL, instanceName)
	payload := map[string]any{
		"number":   toNumber,
		"text":     text,
		"options":  map[string]any{"delay": 1200, "presence": "composing"},
	}
	return c.post(ctx, url, payload)
}

// SendMediaMessage sends a media message (image/audio/video/document) via URL.
func (c *Client) SendMediaMessage(ctx context.Context, instanceName, toNumber, mediaType, mediaURL, caption string) error {
	url := fmt.Sprintf("%s/message/sendMedia/%s", c.BaseURL, instanceName)
	payload := map[string]any{
		"number":   toNumber,
		"mediatype": mediaType,
		"media":     mediaURL,
		"caption":   caption,
		"options":   map[string]any{"delay": 1200},
	}
	return c.post(ctx, url, payload)
}

func (c *Client) post(ctx context.Context, url string, payload map[string]any) error {
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.APIKey != "" {
		req.Header.Set("apikey", c.APIKey)
	}

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("evolution send: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	var errBody map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&errBody)
	return fmt.Errorf("evolution send status %d: %v", resp.StatusCode, errBody)
}
