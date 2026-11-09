# Development cost model

Target ceiling: ₹1,000/month. No paid service has been activated. Local development
has ₹0 newly committed recurring charges, excluding existing hardware, internet and
electricity. Existing budget envelopes: inference ₹500, hosting/network ₹200,
incidentals ₹200, reserve ₹100. These are allocations, not vendor quotes.

For one conversation minute, define s = total recognized audio minutes across both
speakers, t = translation characters, v = synthesized characters, and g = relayed GB.
With operator-verified INR prices A/min ASR, T/million translation characters,
V/million TTS characters and R/GB relay:

`cost/min = s*A + (t/1,000,000)*T + (v/1,000,000)*V + g*R`

Illustrative assumptions only (not live provider prices): s=1, t=v=700,
A=₹0.50, T=₹1,000, V=₹1,500, g=0.001, R=₹10 yields ₹2.26/min.
At that hypothetical price ₹500 allows about 221 conversation minutes. Double
recognition time for overlapping/two always-on streams as applicable. Model silence,
retries, taxes, FX, synthesis output length and TURN ingress/egress billing separately.

A provider without the requested pair has no usable price for that pair. Evaluate
LibreTranslate/Argos regional coverage first, then hosted IndicTrans2 or a commercial
adapter with native-speaker quality review; none is purchased by this code.

REQUEST_LIMIT defaults to 50 requests per API process. Each input is at most 2000
characters and each request has a timeout. This is not a currency cap: restarts reset
it and upstream cancellation may still be billed. Before a paid provider is enabled,
set a hard provider-side allowance plus durable transaction-safe server metering.
If the provider offers no hard cap, do not use it unattended under this budget.
