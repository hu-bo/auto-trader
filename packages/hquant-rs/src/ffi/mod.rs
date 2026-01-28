//! FFI module for cross-language bindings

#[cfg(feature = "ffi-node")]
pub mod node;

#[cfg(feature = "ffi-python")]
pub mod python;
