# esptool-js license evaluation

RealityWarden's built-in governed flasher uses `esptool-js` version `0.6.0`,
published by Espressif Systems under the Apache License 2.0:
https://github.com/espressif/esptool-js

Apache-2.0 permits use, modification, and redistribution, including in this
desktop application, subject to preserving the license and notices and
marking modifications. RealityWarden does not modify or copy the flashing
protocol implementation. The desktop build bundles the installed upstream
package into a CommonJS runtime artifact because the Electron main process is
CommonJS; the adapter around it only presents the existing Node `serialport`
handle in the Web Serial shape expected by `esptool-js`.

The upstream license is retained in the installed production dependency at
`node_modules/esptool-js/LICENSE`. Its bundled pako dependency carries the
MIT/Zlib notice emitted into the generated runtime artifact by esbuild.
