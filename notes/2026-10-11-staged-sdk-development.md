# Staged SDK development pins

Planner decision `1144d3d0a5561d051c4bd6584f24bb64ba570d41` permits these six compiled SDK archives for Jam development while public npm publication is unresolved. They were staged from Artroom main `3bd18314efed78ee757b5b2f9d5bdb3198250c1d`, tree `0be9f4dae4c8f60ee5074275b9e18c7eb77add2a`, by producer/checker execution 94781, both exit 0. This branch claims no npm publication.

The archives in `vendor/artroom-sdk/0.1.0-dev.2/` are unchanged. `package.json` selects all six as portable file development dependencies. `package-lock.json` retains their actual archive integrity values and the exact three public dependencies: Noble curves 2.4.0, Noble hashes 2.4.0 and JSONata 2.2.2. It changes only the scratch lock’s root metadata, portable archive paths and development flags. No Artroom Source import, workspace link, alias or override is used. Apache-2.0 SDK license and notice files remain inside the archives; the three public dependencies are MIT.

| Package | Bytes | SHA-256 | SHA-512 integrity |
|---|---:|---|---|
| @generalbusiness/artroom-bytes | 31385 | `3ad60c796b2185876c395db38ee4bbf661c01ced8438fe539db5d249b6399db6` | `sha512-WG0tZ7B1kJYl4nG4ikEGKOoHgq9ZV1d44OJ8ipcFNpatq6L/P98l+WfrawBtaZRdQ6cNAXz7FLV2iUWRjpSwAA==` |
| @generalbusiness/artroom-client | 36474 | `47de0e5da487dc592470b0e82aa4fcb26ecd6092c97dc3118f0d267420101a11` | `sha512-5arNE5TBAsi5bPcvkkRwS2DYd0Wsc2b1SFoQnTsew2ZaIcggFNmWUa4rM9nyFbFpcPBqaXK6VN5sIL9VLrP8RA==` |
| @generalbusiness/artroom-contract | 33218 | `fbf2ce4d8cdd14c85fa2b802a6ff8b9df9e0b625fdfd270df20ec8352a1c6a58` | `sha512-pNt4ilZh6mdlo8jcARWx7t1oo02j+XMRngv97P7f1PdYjRho4eXQfUB10T1uAzGN2UVTa11/tCEaALnG/+UXlA==` |
| @generalbusiness/artroom-derive | 346672 | `7c271437a8c529828969e775880a1efdb999e911d50531816639f546e5934f21` | `sha512-BBIoRK1lMAMC4gV8sZWa2a4p9xLOTpu2g23/IvZeajPnVGhWbjOPQGLqOx4s1Xxu7OAppx8CPAnUed+0iXmQvw==` |
| @generalbusiness/artroom-platform | 142408 | `5475050193dae3b31b2e7d176cc1e7ebcfd08e47e9d57b3cfe2e114087e085b7` | `sha512-584qElfjKtv47Oe6hyu8vklz/uVm44D4roxQm1FrVbQDQY0lSh0fHgmloIIFQIBjrR+xRqHsy2Nbg/4344yOTw==` |
| @generalbusiness/artroom-replay | 47151 | `2ecc290a509cc248272fd70bb60ba478a630f7723f50a087cb42ea0081b31256` | `sha512-ew/xAqYtt1ZlOvBiPFIlc3U9bXmBZx4wyG24raU+yPLNF7R9oj5FAm8DMY4PgxuoDrL87klvxZtzezDUk2KElA==` |

Full portable pin metadata is in `vendor/artroom-sdk/0.1.0-dev.2/provenance.json`. The original public SDK projection has SHA-256 `845e2b9a037b3fcf9d4e070adfdee03d9dd0205a733deff99c1e459405ea4ddb`.

The scratch consumer checks are separate evidence. Browser compilation passed at Jam `560938e184a31239a3d3150fd192ed3ce5520743`; Node test compilation passed at `d967a3bec6a9f37fda45d6c4f16badf07ebe512e`; Worker compilation, the existing one-case replay predicate and the normal browser build passed at `8aae0401aaa6ec7cc7a2404832757ba8e86f7815`. The later test-only and Worker-only corrections do not enter the previously passed browser closure, and the Worker correction does not enter the Node test closure. Earlier failed compiler attempts and the mistaken lock-path preflight/dispatch order remain retained; they are not a successful pipeline.

The full Jam declaration was then validated once at `8aae0401aaa6ec7cc7a2404832757ba8e86f7815` with the actual compiled public validator and rule profiles, using the approved 3bd Scope bounds. It has 18,500 canonical bytes and candidate definition digest `sha256:a2561341c69154e6b310478ad3d650c97602aa5177b52d41716469f1b2cd2bc2`, with no problems. This is no activated native pin. Public proof hashes: consumer `ddb3c92ebe41ff449209103acc24d93093308c7036ef43a0f7a5cc8212fb6a4c`; declaration `d021eaec1da0d69b29474d0e619a36bd7ca79dc85d66dea21c1545fe93bba14e`.

This portable lock has not yet had its own scratch `npm ci --ignore-scripts` identity check. No package was installed in the Jam checkout. The native page remains unactivated and does not replace the procedural demo at `https://artroom-jam.inguz.workers.dev/`. Native application creation, actor grants, complete replay, provider output, browser and audio witnesses, branch review and any deployment remain separate work.
