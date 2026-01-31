# hquant-rs

High-performance quantitative trading core engine in Rust, with Node.js (napi-rs) and Python (PyO3) bindings.

## Packages

- `packages/hquant-rs`: Rust core (DSL, indicators, vector-store, aggregation, backtests)
- `packages/hquant-js`: Node.js binding (`@hquant/js`)
- `packages/hquant-py`: Python binding (`hquant`)

## Build

See `docs/BUILD.md` for the full build guide.

### Build Node native addon

```bash
cd packages/hquant-rs
cargo build --release --features ffi-node

# macOS
cp target/release/libhquant.dylib ../hquant-js/native/hquant.node
# Linux
cp target/release/libhquant.so ../hquant-js/native/hquant.node
```

### Build Python extension (maturin)

```bash
cd packages/hquant-py
maturin develop --features ffi-python
```

## Tests

- Rust: `cargo test` (optional; wrapper e2e tests are the primary validation)
- Node: `cd ../hquant-js && npm test`
- Python: `cd ../hquant-py && pytest -q test_e2e.py` (after `maturin develop`)

## DSL (very short)

- One rule per line: `IF <condition> THEN <BUY|SELL|HOLD>`
- Variables: `LET x = <expr>`
- Multi-period references use `field@<period>` (only supported by the Rust `MultiHQuant` runtime)

## Docs

- `docs/TECHNICAL.md`: architecture notes + module map
- `docs/BUILD.md`: build & publish notes (Node/Python)

## License

GPL-3.0-or-later

