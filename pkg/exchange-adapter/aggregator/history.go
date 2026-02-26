package aggregator

import (
	"fmt"
	"sort"

	md "github.com/pkg/exchange-adapter/marketdata"
)

type candleBucket struct {
	candle  md.NormalizedCandle
	firstTs int64
	lastTs  int64
}

func AggregateCandlesByPeriod(candles []md.NormalizedCandle, sourcePeriod, targetPeriod md.Period) ([]md.NormalizedCandle, error) {
	if !sourcePeriod.IsValid() {
		return nil, fmt.Errorf("invalid source period: %s", sourcePeriod)
	}
	if !targetPeriod.IsValid() {
		return nil, fmt.Errorf("invalid target period: %s", targetPeriod)
	}

	if len(candles) == 0 {
		return []md.NormalizedCandle{}, nil
	}

	sourceInterval := sourcePeriod.IntervalMs()
	targetInterval := targetPeriod.IntervalMs()

	if sourceInterval <= 0 || targetInterval <= 0 {
		return nil, fmt.Errorf("invalid period intervals source=%d target=%d", sourceInterval, targetInterval)
	}

	if targetInterval < sourceInterval || targetInterval%sourceInterval != 0 {
		return nil, fmt.Errorf("target period %s cannot aggregate source period %s", targetPeriod, sourcePeriod)
	}

	if targetPeriod == sourcePeriod {
		copied := append([]md.NormalizedCandle(nil), candles...)
		sort.Slice(copied, func(i, j int) bool {
			return copied[i].Timestamp > copied[j].Timestamp
		})
		return copied, nil
	}

	sorted := append([]md.NormalizedCandle(nil), candles...)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Timestamp < sorted[j].Timestamp
	})

	buckets := make(map[int64]*candleBucket)

	for _, sourceCandle := range sorted {
		sourceTs := sourceCandle.Timestamp
		bucketTs := targetPeriod.RoundToInterval(sourceTs)

		bucket, ok := buckets[bucketTs]
		if !ok {
			aggregated := sourceCandle
			aggregated.Timestamp = bucketTs
			aggregated.Period = string(targetPeriod)

			buckets[bucketTs] = &candleBucket{
				candle:  aggregated,
				firstTs: sourceTs,
				lastTs:  sourceTs,
			}
			continue
		}

		updateOpen := sourceTs < bucket.firstTs
		updateClose := sourceTs > bucket.lastTs

		if updateOpen {
			bucket.firstTs = sourceTs
		}

		if updateClose {
			bucket.lastTs = sourceTs
		}

		mergeOHLCV(
			&bucket.candle.Open,
			&bucket.candle.High,
			&bucket.candle.Low,
			&bucket.candle.Close,
			&bucket.candle.Volume,
			&bucket.candle.BuyVolume,
			sourceCandle.Open,
			sourceCandle.High,
			sourceCandle.Low,
			sourceCandle.Close,
			sourceCandle.Volume,
			sourceCandle.BuyVolume,
			mergeOHLCVOptions{
				UpdateOpen:   updateOpen,
				UpdateClose:  updateClose,
				AddVolume:    true,
				AddBuyVolume: true,
			},
		)

		if bucket.candle.SymbolFamily == "" && sourceCandle.SymbolFamily != "" {
			bucket.candle.SymbolFamily = sourceCandle.SymbolFamily
		}
	}

	result := make([]md.NormalizedCandle, 0, len(buckets))
	for _, bucket := range buckets {
		result = append(result, bucket.candle)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Timestamp > result[j].Timestamp
	})

	return result, nil
}
