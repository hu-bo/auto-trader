package utils

import "math"

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
