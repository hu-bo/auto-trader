# DSL Meta String Syntax Update

## Summary

Updated the HQuant DSL to support string literals in action metadata, allowing both quoted and unquoted syntax.

## Changes Made

### 1. Grammar Update (`src/dsl/grammar.pest`)

Modified the action meta parsing to support both string literals and bare text:

```pest
action = { action_name ~ action_meta? }
action_name = @{ ^"BUY" | ^"SELL" | ^"HOLD" }
action_meta = { "(" ~ meta_value ~ ")" }
meta_value = _{ string | meta_inner }
meta_inner = @{ (!")" ~ ANY)* }
```

### 2. Parser Update (`src/dsl/mod.rs`)

Updated the `parse_action` function to handle both string and bare text meta values:

```rust
fn parse_action(pair: pest::iterators::Pair<'_, Rule>) -> Result<(Action, Option<String>), StrategyError> {
    // ... existing code ...
    let meta = inner.next().map(|p| {
        p.into_inner()
            .next()
            .map(|x| {
                match x.as_rule() {
                    Rule::string => parse_string(x.as_str()),
                    Rule::meta_inner => x.as_str().trim().to_string(),
                    _ => x.as_str().trim().to_string(),
                }
            })
            .unwrap_or_default()
    });
    // ... rest of code ...
}
```

### 3. Example Updates

Updated both example files to demonstrate the new syntax:

- `examples/strategy_dsl.txt`
- `examples/strategy_dsl_complete.txt`

### 4. Test Coverage

Added a new test `dsl_action_meta_supports_string_syntax` in `src/lib.rs` to verify both syntaxes work correctly.

## Usage Examples

### String Syntax (Recommended)
```
IF rsi < 30 THEN BUY("multi-period oversold")
IF rsi > 70 THEN SELL("overbought signal")
IF close > ma THEN BUY("trend following")
```

### Bare Text Syntax (Backward Compatible)
```
IF rsi < 30 THEN BUY(multi-period oversold)
IF rsi > 70 THEN SELL(overbought signal)
IF close > ma THEN BUY(trend following)
```

## Benefits

1. **Clearer Intent**: String quotes make it obvious that the text is metadata
2. **Special Characters**: Strings can contain any characters including spaces, hyphens, etc.
3. **Backward Compatible**: Old bare text syntax still works
4. **Consistent**: Matches the string syntax used elsewhere in the DSL (e.g., `VEC_STORE("name")`)

## Testing

All tests pass (11/11):
- Existing tests verify backward compatibility
- New test verifies string meta syntax works correctly
- Both syntaxes can be used interchangeably

```bash
cargo test
# test result: ok. 11 passed; 0 failed; 0 ignored
```
