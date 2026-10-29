# A6400: feasibility after the real Wi-Fi audit

## Evidence from the supplied device report

The completed audit identified Smart Remote Control __SAK__ 2.1.7 and returned
80 method signatures (68 distinct names). It did not advertise setters for
Creative Style, its contrast/saturation/sharpness, WB fine shifts, or DRO.
Creative Style and Picture Effect fields appeared only inside getEvent response
schemas, not as write operations. Schema fields do not establish that actual
values are returned on this model.

The sample was Manual, still, ISO AUTO, BULB, f/5. It returned EV 0 from
getExposureCompensation and -10 from getAvailableExposureCompensation. These
were separate reads, with no setting write in this audit: neither should be
silently treated as the authoritative confirmation of an earlier write.

## USB/PTP evidence and limits

- gPhoto lists Sony ILCE-6400 (PC Control) with Configuration support. This proves
  a useful investigation path, not full recipe support:
  https://gphoto.sourceforge.io/proj/libgphoto2/support.php
- libgphoto2 defines Sony DRangeOptimize D201, ColorTemp D20F, CCFilter D210,
  PictureEffect D21B, ABFilter D21C, CreativeStyle D240. A constant in a driver
  does not mean the A6400 advertises or allows writing it:
  https://github.com/gphoto/libgphoto2/blob/master/camlibs/ptp2/ptp.h
- The pysonycamera README describes Creative Style codes, but its stated tested
  configuration is RX100 VII on Windows; A6400 support cannot be inferred:
  https://github.com/inobotica/pysonycamera
- Creative Look properties used on newer Sony bodies must not be substituted
  for Creative Style without verified mapping.

No verified A6400 write path for the entire recipe was established by this review.
The next evidence required is its USB configuration inventory. No mobile changes
or APK build are needed to collect that inventory.

## Run on the Mac, not Codespaces

Install prerequisites once (internet required only for installation):

```sh
brew install gphoto2
```

Python 3 is also required. Connect the camera to the Mac using a data-capable USB
cable and select PC Remote / PC Control for the USB connection on the camera.
Close applications using the camera USB connection. The Mac can keep its normal
Wi-Fi internet connection; it does not need the camera Wi-Fi for this test.

```sh
cd ~/Developer/Lab-6400
git pull --rebase --autostash
python3 scripts/ptp_audit.py
```

The script automatically selects exactly one Sony ILCE-6400/6400A identified in
PC Control mode. It stops if none or multiple are found. It executes only version,
auto-detect, summary and list-all-config commands, with 90-second per-command
limits. It does not request setting writes, capture, deletion or download of
images. gphoto2 opens/initializes the remote USB session internally.

The output is `sony-ptp-diagnostico-<timestamp>.json` in the current folder. Errors
and partial command output are preserved. `Readonly: 0` is reported as advertised
by the driver, not as proof of a successful write. Unrecognized/raw properties
are retained. Missing controls may reflect a driver limitation, so their absence
is not proof that all PTP implementations lack support. The summary may contain
the camera serial number; the file is local and nothing is uploaded automatically.

## Validation

`python3 tests/ptp-audit.py`: eight tests passed, covering command allowlist,
explicit model/port targeting, absent/ambiguous/other-model cameras, 6400A,
failed commands with partial output, malformed config, missing readonly flag,
missing executable and timeout output. No physical USB camera was available in
the development environment; gphoto2 behavior on the user's Mac remains untested.

Do not add PTP setting writes to the app until the inventory identifies the
required controls, their types/ranges, and actual writes can be read back and
verified on the A6400. USB success would not establish PTP-over-Wi-Fi support.

## Results from the actual USB inventory (firmware 2.0)

The supplied Atilio inventory completed over USB with gphoto2 2.5.32. It contains
101 configuration entries; these are not 101 distinct camera properties because
named controls and raw `/main/other` entries overlap. Its property summary has
63 entries: 47 marked rw, 15 ro, and one failed descriptor (D220, PTP error 2002).
The audit collector now explicitly preserves descriptor warnings despite exit 0.
A completed command sequence is not proof of a fully readable device.

| Recipe component | Observed USB evidence | Conclusion |
| --- | --- | --- |
| WB mode | 5005 rw; named whitebalance writable | Write candidate, not tested |
| WB temperature | D20F ro; 2500–9900 step 100, current 0 | Not writable in this snapshot (WB Automatic); no mode transition tested |
| WB G/M | D210 rw; 164–220 step 1, current 192 | Mapping to recipe units/direction unverified |
| WB A/B | D21C rw; 164–220 step 2, current 192 | Mapping to recipe units/direction unverified |
| DRO/HDR | D201 rw; named DRO choices | Write candidate, not tested |
| Picture Effect | D21B rw; numeric enumeration | Distinct from Creative Style; mapping must be verified |
| Creative Style | D240 absent from config and property summary | No advertised direct property in this session |
| Contrast/saturation/sharpness | No named entries or identified properties | No verified write path |
| EV | 5010 ro but D200 rw | Different properties; do not treat as equivalent without validation |

Unknown properties were D212 (rw, 0–15), D22E (ro), D232 (ro), D233 (ro),
D236 (rw, 0/1), and the failed D220. The observed range alone cannot identify a
property as Creative Style or justify writing it. No blind writes were added.
Remote directional keys do not prove the full camera menu can be automated; no
menu-open/confirm workflow or resulting recipe-state readback has been verified.

Review of libgphoto2's generic `other` section shows it iterates the reported
DeviceProps and attempts to read descriptors even when they have no friendly
label. Therefore D240's absence is stronger evidence than a missing named UI
control. It still does not exclude a different negotiated session/protocol, an
unadvertised operation, or a firmware-specific extension.
Source: https://github.com/gphoto/libgphoto2/blob/master/camlibs/ptp2/config.c

### Current engineering decision

Full-recipe delivery remains blocked. Do not ship a PTP APK, translate Creative
Look IDs to Creative Style, rename unknown properties, or label a partial WB/DRO
write as a completed recipe. The missing dependency is a verified A6400 command
or reproducible control sequence for Creative Style and its three parameters.
Further progress requires model-specific protocol evidence or controlled physical
reverse engineering; another repetition of this inventory is not required.
No serial numbers or full user diagnostic were committed.
