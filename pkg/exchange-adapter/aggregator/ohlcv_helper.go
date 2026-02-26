package aggregator

type mergeOHLCVOptions struct {
	UpdateOpen   bool
	UpdateClose  bool
	AddVolume    bool
	AddBuyVolume bool
}

func mergeOHLCV(
	targetOpen, targetHigh, targetLow, targetClose, targetVolume, targetBuyVolume *float64,
	sourceOpen, sourceHigh, sourceLow, sourceClose, sourceVolume, sourceBuyVolume float64,
	opts mergeOHLCVOptions,
) {
	if opts.UpdateOpen {
		*targetOpen = sourceOpen
	}

	if sourceHigh > *targetHigh {
		*targetHigh = sourceHigh
	}

	if *targetLow == 0 || sourceLow < *targetLow {
		*targetLow = sourceLow
	}

	if opts.UpdateClose {
		*targetClose = sourceClose
	}

	if opts.AddVolume {
		*targetVolume += sourceVolume
	}

	if opts.AddBuyVolume {
		*targetBuyVolume += sourceBuyVolume
	}
}
