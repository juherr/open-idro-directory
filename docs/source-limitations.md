# Source Limitations

AFIREV reuse terms are unspecified. The project publishes provenance and source metadata but does not claim upstream data ownership or a blanket right to reuse upstream data.

AFIREV status `SUSPENDED` is normalized as `UNKNOWN` because the common status enum has no exact suspended state. The original value remains in `metadata.afirevStatus`.

AFIREV type `BOTH` creates separate CPO and EMSP records with the same identifier.
