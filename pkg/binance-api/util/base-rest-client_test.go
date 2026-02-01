package util

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"testing"
)

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestBaseRestClient_UnsignedPost_NoBody(t *testing.T) {
	t.Parallel()

	client := NewBaseRestClient(RestClientOptions{
		APIKey:    "test-key",
		APISecret: "test-secret",
		BaseURL:   "http://example.test",
	})

	var gotReq *http.Request
	var gotBody []byte
	client.client.SetTransport(roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		gotReq = r
		if r.Body != nil {
			gotBody, _ = io.ReadAll(r.Body)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(bytes.NewBufferString(`{"listenKey":"abc"}`)),
			Request:    r,
		}, nil
	}))

	var result struct {
		ListenKey string `json:"listenKey"`
	}
	if err := client.Post(context.Background(), "/api/v3/userDataStream", nil, false, &result); err != nil {
		t.Fatalf("post: %v", err)
	}
	if gotReq == nil {
		t.Fatal("expected request to be captured")
	}
	if gotReq.Method != http.MethodPost {
		t.Fatalf("expected method POST, got %s", gotReq.Method)
	}
	if gotReq.URL.Path != "/api/v3/userDataStream" {
		t.Fatalf("expected path /api/v3/userDataStream, got %s", gotReq.URL.Path)
	}
	if gotReq.URL.RawQuery != "" {
		t.Fatalf("expected empty query string, got %q", gotReq.URL.RawQuery)
	}
	if got := gotReq.Header.Get("X-MBX-APIKEY"); got != "test-key" {
		t.Fatalf("expected X-MBX-APIKEY header, got %q", got)
	}
	if len(gotBody) != 0 {
		t.Fatalf("expected empty body, got %q", string(gotBody))
	}
	if result.ListenKey != "abc" {
		t.Fatalf("expected listenKey %q, got %q", "abc", result.ListenKey)
	}
}

func TestBaseRestClient_UnsignedPut_UsesQueryParams_NoBody(t *testing.T) {
	t.Parallel()

	client := NewBaseRestClient(RestClientOptions{
		APIKey:    "test-key",
		APISecret: "test-secret",
		BaseURL:   "http://example.test",
	})

	var gotReq *http.Request
	var gotBody []byte
	client.client.SetTransport(roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		gotReq = r
		if r.Body != nil {
			gotBody, _ = io.ReadAll(r.Body)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(bytes.NewBufferString(`{}`)),
			Request:    r,
		}, nil
	}))

	if err := client.Put(
		context.Background(),
		"/api/v3/userDataStream",
		map[string]interface{}{"listenKey": "abc"},
		false,
		nil,
	); err != nil {
		t.Fatalf("put: %v", err)
	}
	if gotReq == nil {
		t.Fatal("expected request to be captured")
	}
	if gotReq.Method != http.MethodPut {
		t.Fatalf("expected method PUT, got %s", gotReq.Method)
	}
	if gotReq.URL.Path != "/api/v3/userDataStream" {
		t.Fatalf("expected path /api/v3/userDataStream, got %s", gotReq.URL.Path)
	}
	if got := gotReq.URL.Query().Get("listenKey"); got != "abc" {
		t.Fatalf("expected listenKey query param %q, got %q", "abc", got)
	}
	if len(gotBody) != 0 {
		t.Fatalf("expected empty body, got %q", string(gotBody))
	}
}
