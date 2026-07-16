# Owner-Controlled Legal Release Inputs

This directory is the fixed input location for a production Windows release.
The actual inputs are ignored by Git because they are release-specific and must
be approved by the product owner and qualified counsel for the intended sales
jurisdictions. RealityWarden does not generate or judge their legal adequacy.

Required files:

- `PRODUCT_EULA.txt` — owner-approved UTF-8 EULA shown by the NSIS installer;
- `PRIVACY_NOTICE.txt` — owner-approved UTF-8 privacy notice shipped in the
  public release upload set;
- `manifest.json` — exact approval metadata and SHA-256 bindings.

The manifest schema is strict:

```json
{
  "schema": "realitywarden.legal-release-inputs",
  "schema_version": 1,
  "product": "RealityWarden",
  "release_version": "0.5.0",
  "approval_scope": "production_release",
  "approved_at": "2026-07-16T00:00:00.000Z",
  "approved_by": "owner or counsel identity",
  "approval_reference": "non-secret review reference",
  "publisher": {
    "legal_name": "approved publisher legal name",
    "jurisdiction": "publisher formation jurisdiction",
    "support_email": "support contact",
    "privacy_email": "privacy contact"
  },
  "sales_jurisdictions": ["CN"],
  "documents": {
    "eula": { "file": "PRODUCT_EULA.txt", "sha256": "64 lowercase hex characters" },
    "privacy_notice": { "file": "PRIVACY_NOTICE.txt", "sha256": "64 lowercase hex characters" }
  }
}
```

Run `npm run release:legal:verify` before production packaging. The validator
rejects missing/unknown fields, version drift, path changes, placeholders,
digest changes, wrong-product documents, and documents that omit the approved
publisher name. Passing proves input integrity only; it is not legal advice.
