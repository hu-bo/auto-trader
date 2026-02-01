// Package util provides utility functions for Binance API.
package util

import (
	"crypto/ed25519"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/url"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/binance-api/types"
)

// BaseURLMap contains base URLs for different Binance products.
var BaseURLMap = map[types.BinanceBaseURLKey]string{
	types.BaseURLSpot:         "https://api.binance.com",
	types.BaseURLSpot1:        "https://api1.binance.com",
	types.BaseURLSpot2:        "https://api2.binance.com",
	types.BaseURLSpot3:        "https://api3.binance.com",
	types.BaseURLSpot4:        "https://api4.binance.com",
	types.BaseURLSpotTest:     "https://testnet.binance.vision",
	types.BaseURLUSDM:         "https://fapi.binance.com",
	types.BaseURLUSDMTest:     "https://testnet.binancefuture.com",
	types.BaseURLCOINM:        "https://dapi.binance.com",
	types.BaseURLCOINMTest:    "https://testnet.binancefuture.com",
	types.BaseURLVOptions:     "https://eapi.binance.com",
	types.BaseURLVOptionsTest: "https://testnet.binanceops.com",
	types.BaseURLPAPI:         "https://papi.binance.com",
	types.BaseURLWWW:          "https://www.binance.com",
}

// GetServerTime returns the current server time in milliseconds.
func GetServerTime() int64 {
	return time.Now().UnixMilli()
}

// SignHMACSHA256 signs a message using HMAC-SHA256.
func SignHMACSHA256(message, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(message))
	return hex.EncodeToString(mac.Sum(nil))
}

// SignHMACSHA256Base64 signs a message using HMAC-SHA256 and returns base64 encoded result.
func SignHMACSHA256Base64(message, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(message))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

// SignED25519 signs a message using Ed25519.
func SignED25519(message string, privateKey ed25519.PrivateKey) string {
	signature := ed25519.Sign(privateKey, []byte(message))
	return base64.StdEncoding.EncodeToString(signature)
}

// SerializeParams serializes parameters to a query string.
func SerializeParams(params interface{}, strictValidation, encodeValues, filterUndefined bool) string {
	if params == nil {
		return ""
	}

	// Handle map type
	if m, ok := params.(map[string]interface{}); ok {
		return serializeMap(m, encodeValues, filterUndefined)
	}

	// Handle struct type using reflection
	v := reflect.ValueOf(params)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}

	if v.Kind() != reflect.Struct {
		return ""
	}

	return serializeStruct(v, encodeValues, filterUndefined)
}

func serializeMap(m map[string]interface{}, encodeValues, filterUndefined bool) string {
	// Sort keys for consistent ordering
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var parts []string
	for _, k := range keys {
		v := m[k]
		if filterUndefined && v == nil {
			continue
		}

		strVal := formatValue(v)
		if strVal == "" && filterUndefined {
			continue
		}

		if encodeValues {
			strVal = url.QueryEscape(strVal)
		}
		parts = append(parts, fmt.Sprintf("%s=%s", k, strVal))
	}

	return strings.Join(parts, "&")
}

func serializeStruct(v reflect.Value, encodeValues, filterUndefined bool) string {
	t := v.Type()
	var parts []string

	for i := 0; i < v.NumField(); i++ {
		field := t.Field(i)
		fieldValue := v.Field(i)

		// Get json tag
		jsonTag := field.Tag.Get("json")
		if jsonTag == "" || jsonTag == "-" {
			continue
		}

		// Parse json tag
		tagParts := strings.Split(jsonTag, ",")
		name := tagParts[0]

		// Check omitempty
		omitempty := false
		for _, part := range tagParts[1:] {
			if part == "omitempty" {
				omitempty = true
				break
			}
		}

		// Skip zero values if omitempty
		if omitempty && isZeroValue(fieldValue) {
			continue
		}

		strVal := formatReflectValue(fieldValue)
		if strVal == "" && filterUndefined {
			continue
		}

		if encodeValues {
			strVal = url.QueryEscape(strVal)
		}
		parts = append(parts, fmt.Sprintf("%s=%s", name, strVal))
	}

	return strings.Join(parts, "&")
}

func isZeroValue(v reflect.Value) bool {
	switch v.Kind() {
	case reflect.String:
		return v.String() == ""
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return v.Int() == 0
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return v.Uint() == 0
	case reflect.Float32, reflect.Float64:
		return v.Float() == 0
	case reflect.Bool:
		return !v.Bool()
	case reflect.Slice, reflect.Map:
		return v.IsNil() || v.Len() == 0
	case reflect.Ptr, reflect.Interface:
		return v.IsNil()
	default:
		return false
	}
}

func formatValue(v interface{}) string {
	if v == nil {
		return ""
	}

	switch val := v.(type) {
	case string:
		return val
	case int, int8, int16, int32, int64:
		return fmt.Sprintf("%d", val)
	case uint, uint8, uint16, uint32, uint64:
		return fmt.Sprintf("%d", val)
	case float32:
		return strconv.FormatFloat(float64(val), 'f', -1, 32)
	case float64:
		return strconv.FormatFloat(val, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(val)
	case []int64:
		strs := make([]string, len(val))
		for i, n := range val {
			strs[i] = strconv.FormatInt(n, 10)
		}
		return "[" + strings.Join(strs, ",") + "]"
	case []string:
		return "[" + strings.Join(val, ",") + "]"
	default:
		return fmt.Sprintf("%v", val)
	}
}

func formatReflectValue(v reflect.Value) string {
	switch v.Kind() {
	case reflect.String:
		return v.String()
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return strconv.FormatInt(v.Int(), 10)
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return strconv.FormatUint(v.Uint(), 10)
	case reflect.Float32:
		return strconv.FormatFloat(v.Float(), 'f', -1, 32)
	case reflect.Float64:
		return strconv.FormatFloat(v.Float(), 'f', -1, 64)
	case reflect.Bool:
		return strconv.FormatBool(v.Bool())
	case reflect.Slice:
		if v.Len() == 0 {
			return ""
		}
		var strs []string
		for i := 0; i < v.Len(); i++ {
			strs = append(strs, formatReflectValue(v.Index(i)))
		}
		return "[" + strings.Join(strs, ",") + "]"
	default:
		return fmt.Sprintf("%v", v.Interface())
	}
}

// BuildQueryString builds a query string from parameters.
func BuildQueryString(params map[string]interface{}) string {
	if len(params) == 0 {
		return ""
	}

	var parts []string
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		v := params[k]
		if v == nil {
			continue
		}
		parts = append(parts, fmt.Sprintf("%s=%s", k, url.QueryEscape(formatValue(v))))
	}

	return strings.Join(parts, "&")
}

// MergeParams merges multiple parameter maps into one.
func MergeParams(params ...map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for _, p := range params {
		for k, v := range p {
			result[k] = v
		}
	}
	return result
}

// StructToMap converts a struct to map[string]interface{}.
func StructToMap(s interface{}) map[string]interface{} {
	result := make(map[string]interface{})

	if s == nil {
		return result
	}

	v := reflect.ValueOf(s)
	if v.Kind() == reflect.Ptr {
		if v.IsNil() {
			return result
		}
		v = v.Elem()
	}

	switch v.Kind() {
	case reflect.Map:
		for _, key := range v.MapKeys() {
			if key.Kind() != reflect.String {
				continue
			}
			val := v.MapIndex(key)
			if !val.IsValid() {
				continue
			}
			if val.Kind() == reflect.Interface && val.IsNil() {
				continue
			}
			switch val.Kind() {
			case reflect.Chan, reflect.Func, reflect.Map, reflect.Ptr, reflect.Slice:
				if val.IsNil() {
					continue
				}
			}
			result[key.String()] = val.Interface()
		}
		return result
	case reflect.Struct:
		// continue below
	default:
		return result
	}

	t := v.Type()
	for i := 0; i < v.NumField(); i++ {
		field := t.Field(i)
		fieldValue := v.Field(i)

		jsonTag := field.Tag.Get("json")
		if jsonTag == "" || jsonTag == "-" {
			continue
		}

		tagParts := strings.Split(jsonTag, ",")
		name := tagParts[0]

		omitempty := false
		for _, part := range tagParts[1:] {
			if part == "omitempty" {
				omitempty = true
				break
			}
		}

		if omitempty && isZeroValue(fieldValue) {
			continue
		}

		result[name] = fieldValue.Interface()
	}

	return result
}
