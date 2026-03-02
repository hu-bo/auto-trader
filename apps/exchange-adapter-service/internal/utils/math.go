package utils

import "math"

// RoundFloat rounds v to the given decimal precision.
func RoundFloat(v float64, precision int) float64 {
	p := math.Pow(10, float64(precision))
	return math.Round(v*p) / p
}

// DiffPercent returns absolute percentage difference between local and remote.
func DiffPercent(local, remote float64) float64 {
	if remote == 0 {
		if local == 0 {
			return 0
		}
		return 100
	}
	return math.Abs((local-remote)/remote) * 100
}
