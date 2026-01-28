fn main() {
    #[cfg(feature = "ffi-node")]
    napi_build::setup();
}
