package util

type APIError struct {
	Code    string
	Message string
	Raw     []byte
}

func (e *APIError) Error() string {
	if e == nil {
		return "okx api error"
	}
	if e.Code == "" && e.Message == "" {
		return "okx api error"
	}
	if e.Code == "" {
		return e.Message
	}
	if e.Message == "" {
		return e.Code
	}
	return e.Code + ": " + e.Message
}
