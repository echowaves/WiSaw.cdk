## 1. Fix reverseGeocode response parsing

- [ ] 1.1 Replace `item.Title` extraction with structured `item.Address` field chain: `Locality → District → SubRegion.Name → Region.Name → Country.Name`

## 2. Fix walk loop to skip instead of break

- [ ] 2.1 Change the distance walk loop from `break` on out-of-range photo to `continue` (skip), so all in-range photos in the batch are collected into one wave
