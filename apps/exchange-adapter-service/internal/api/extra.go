package api

import (
	"runtime/debug"

	"github.com/labstack/echo/v4"
)

type VersionData struct {
	Service   string `json:"service"`
	Version   string `json:"version"`
	GoVersion string `json:"go_version,omitempty"`
}

func (h *Handler) Ready(c echo.Context) error {
	return SuccessWithMessage[any](c, "ready", nil)
}

func (h *Handler) Version(c echo.Context) error {
	version := "dev"
	goVersion := ""
	if bi, ok := debug.ReadBuildInfo(); ok {
		version = bi.Main.Version
		goVersion = bi.GoVersion
	}
	return Success(c, VersionData{
		Service:   "exchange-adapter-service",
		Version:   version,
		GoVersion: goVersion,
	})
}
