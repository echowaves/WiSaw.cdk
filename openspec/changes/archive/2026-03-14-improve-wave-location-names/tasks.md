## 1. Update reverseGeocode to return compound names

- [x] 1.1 Modify `reverseGeocode` to detect US via `Country.Code2 === 'US'` and return `"{city}, {state}"` for US or `"{city}, {country}"` for non-US, with single-level fallback when city is unavailable
