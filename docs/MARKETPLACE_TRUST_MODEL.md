# Marketplace trust model

Status: v0.6 trust-kernel implementation. The in-app catalog and durable UI
workflow remain separate delivery work; this document does not claim the
Marketplace alpha is complete.

Marketplace packages are declarative data. They never contain adapters,
scripts, commands, hooks, endpoints, credentials, or post-install behavior.
The package signature proves which reviewed key signed the exact bytes; it
does not prove that the package is safe and never grants execution authority.

## Trust and validation order

1. Parse the strict, versioned package envelope. Unknown envelope fields are
   rejected rather than stripped.
2. Reject non-JSON data, cycles, executable/secret-bearing keys, and
   prototype-pollution keys.
3. Resolve exactly one publisher key from the consumer's local trust store.
   Unknown, ambiguous, or revoked keys are rejected.
4. Verify the Ed25519 signature over canonical JSON.
5. Run the authoritative Reality Asset validator. A valid signature cannot
   override `realAdapterEnabled: false`, support-level boundaries, capability
   rules, or any later runtime safety check.
6. Derive `official`, `verified`, or `community` from the local trust entry.
   A package cannot declare or promote its own tier.

## Lifecycle

- Install requires explicit confirmation and always creates
  `installed_disabled`.
- A second explicit confirmation may enable a validated `simulation_only`
  asset. This does not create a real adapter or execution authority.
- The stored signature and digest are revalidated at enablement time.
- Uninstall removes the complete package record; runtime lookup immediately
  returns no manifest afterward.
- Install, simulation enablement, and uninstall emit audit events with
  `hardwareSignalSent: false` and `executionAuthorityGranted: false`.

## Maintainer signing

Signing is an offline maintainer action. Private keys are never packaged with
the app or committed to this repository.

```bash
npm run marketplace:sign -- --draft reviewed-package-draft.json \
  --private-key publisher-ed25519-private.pem \
  --out signed-marketplace-package.json
```

The command refuses invalid assets and non-declarative content before signing,
uses exclusive output creation to avoid overwriting an existing package, and
does not serialize a trust tier. Consumer trust policy remains independent of
publisher claims.
