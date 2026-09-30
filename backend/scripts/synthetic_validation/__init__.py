"""Validation of the 250 synthetic accounts against the real cohort.

Three standalone checks, each runnable on its own:

    python -m scripts.synthetic_validation.fidelity
    python -m scripts.synthetic_validation.utility_tstr
    python -m scripts.synthetic_validation.privacy_nn

and a runner that does all three and writes a dated markdown report:

    python -m scripts.synthetic_validation.report

All read-only. Nothing is sent to any external service.
"""
