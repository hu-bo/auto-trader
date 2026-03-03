package api

import (
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
)

var requestValidator = validator.New(validator.WithRequiredStructEnabled())

func init() {
	requestValidator.RegisterTagNameFunc(func(field reflect.StructField) string {
		if name := firstTagToken(field.Tag.Get("query")); name != "" && name != "-" {
			return name
		}
		if name := firstTagToken(field.Tag.Get("json")); name != "" && name != "-" {
			return name
		}
		return field.Name
	})
}

func firstTagToken(tag string) string {
	if tag == "" {
		return ""
	}
	name := strings.Split(tag, ",")[0]
	return strings.TrimSpace(name)
}

func validateStruct(v any) []ErrorItem {
	err := requestValidator.Struct(v)
	if err == nil {
		return nil
	}

	validationErrs, ok := err.(validator.ValidationErrors)
	if !ok {
		return []ErrorItem{{Field: "request", Message: err.Error()}}
	}

	items := make([]ErrorItem, 0, len(validationErrs))
	for _, fe := range validationErrs {
		field := fe.Field()
		switch fe.Tag() {
		case "required":
			items = append(items, ErrorItem{Field: field, Message: "is required"})
		case "min":
			items = append(items, ErrorItem{Field: field, Message: "must have at least " + fe.Param() + " item(s)"})
		case "max":
			items = append(items, ErrorItem{Field: field, Message: "must have at most " + fe.Param() + " item(s)"})
		case "gte":
			items = append(items, ErrorItem{Field: field, Message: "must be greater than or equal to " + fe.Param()})
		case "gt":
			items = append(items, ErrorItem{Field: field, Message: "must be greater than " + fe.Param()})
		case "lte":
			items = append(items, ErrorItem{Field: field, Message: "must be less than or equal to " + fe.Param()})
		case "oneof":
			items = append(items, ErrorItem{Field: field, Message: "must be one of: " + fe.Param()})
		default:
			items = append(items, ErrorItem{Field: field, Message: "is invalid"})
		}
	}
	return items
}
