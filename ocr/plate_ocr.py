"""Fast CPU plate OCR entry point for the Guard scan endpoint.

Install on the VPS with: pip install fast-alpr[onnx]
"""
import json
import sys

from fast_alpr import ALPR

DETECTOR_CONFIDENCE_THRESHOLD = 0.85


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("image path required")
    alpr = ALPR(
        detector_model="yolo-v9-t-384-license-plate-end2end",
        detector_conf_thresh=DETECTOR_CONFIDENCE_THRESHOLD,
        ocr_model="cct-xs-v2-global-model",
        detector_providers=["CPUExecutionProvider"],
        ocr_providers=["CPUExecutionProvider"],
    )
    results = alpr.predict(sys.argv[1])
    def confidence(item):
        value = item.ocr.confidence if item.ocr else 0
        return sum(value) / len(value) if isinstance(value, list) and value else float(value)

    best = max(results, key=confidence, default=None)
    print(json.dumps({"plate_no": best.ocr.text if best and best.ocr else "", "confidence": confidence(best) if best else 0}))


if __name__ == "__main__":
    main()
