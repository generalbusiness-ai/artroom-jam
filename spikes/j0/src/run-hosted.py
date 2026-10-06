"""One bounded, authorized J0 reference-audio call; Python standard library only.

Run with python3 -I src/run-hosted.py AUDIO.wav. Never stores request audio/key.
An existing attempt marker prevents accidental inference repetition.
"""
import base64
import datetime
import hashlib
import json
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROTOCOL = json.loads((ROOT / "hosted-protocol.json").read_text())
OUT = ROOT / "work/out/hosted"


def write(name, value):
    (OUT / name).write_text(json.dumps(value, indent=2) + "\n")


def main():
    audio = pathlib.Path(sys.argv[1]).read_bytes()
    assert len(audio) == PROTOCOL["audio"]["bytes"], "audio size differs"
    assert hashlib.sha256(audio).hexdigest() == PROTOCOL["audio"]["sha256"], "audio hash differs"
    key_file = pathlib.Path.home() / ".config/generalbusiness/openrouter.env"
    lines = [x.strip() for x in key_file.read_text().splitlines()
             if x.strip() and not x.lstrip().startswith("#")]
    keys = [x for x in lines if re.fullmatch(r"sk-or-[A-Za-z0-9_-]+", x)]
    if len(keys) != 1:
        raise SystemExit("Expected one bare OpenRouter key; no call made")
    key = keys[0]
    OUT.mkdir(parents=True, exist_ok=True)
    # Exclusive marker remains even after a network failure. No automatic retry.
    with (OUT / "attempt.json").open("x") as f:
        json.dump({"started_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                   "protocol": PROTOCOL}, f, indent=2)
    payload = dict(PROTOCOL["parameters"])
    payload["messages"] = [{"role": "user", "content": [
        {"type": "text", "text": PROTOCOL["prompt"]},
        {"type": "input_audio", "input_audio": {
            "data": base64.b64encode(audio).decode("ascii"), "format": "wav"}}
    ]}]
    headers = {"Authorization": "Bearer " + key, "Content-Type": "application/json"}
    request = urllib.request.Request(PROTOCOL["endpoint"],
                                     json.dumps(payload).encode(), headers)
    start = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        # Do not persist provider error bodies, which might echo request data.
        failure = {"http_status": error.code, "wall_seconds": time.monotonic() - start}
        write("failure.json", failure)
        print(json.dumps(failure))
        return 1
    except Exception as error:
        failure = {"error_type": type(error).__name__, "wall_seconds": time.monotonic() - start}
        write("failure.json", failure)
        print(json.dumps(failure))
        return 1
    wall = time.monotonic() - start
    write("response.json", result)
    usage = result.get("usage", {})
    cost = usage.get("cost")
    cost_source = "response.usage.cost" if cost is not None else None
    generation = None
    if cost is None and re.fullmatch(r"gen-[0-9A-Za-z-]+", result.get("id", "")):
        for attempt in range(2):
            if attempt:
                time.sleep(2)
            url = "https://openrouter.ai/api/v1/generation?" + urllib.parse.urlencode({"id": result["id"]})
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=20) as response:
                    generation = json.load(response)
                write("generation.json", generation)
                cost = generation.get("data", {}).get("total_cost")
                if cost is not None:
                    cost_source = "generation.data.total_cost"
                    break
            except Exception as error:
                write(f"metadata-error-{attempt + 1}.json", {"error_type": type(error).__name__})
    summary = {"requested_model": payload["model"], "response_model": result.get("model"),
               "provider": result.get("provider") or (generation or {}).get("data", {}).get("provider_name"),
               "generation_id": result.get("id"), "wall_seconds": wall, "usage": usage,
               "billed_cost_usd": cost, "cost_source": cost_source,
               "finish_reason": result.get("choices", [{}])[0].get("finish_reason")}
    write("measurement.json", summary)
    print(json.dumps(summary))
    return 0


if __name__ == "__main__":
    sys.exit(main())
