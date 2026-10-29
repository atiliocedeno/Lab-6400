# A6400: full-recipe feasibility after Wi-Fi and USB audits

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
The USB inventory has now also been collected and reviewed below. Do not repeat
it or request a new APK as a remedy for the missing commands.

## Collector reference (already run; not a new user action)

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

`python3 tests/ptp-audit.py`: nine tests passed, covering command allowlist,
explicit model/port targeting, absent/ambiguous/other-model cameras, 6400A,
failed commands with partial output, malformed config, missing readonly flag,
missing executable and timeout output. No physical USB camera was available in
the development environment. The supplied Mac inventory demonstrates collection,
not successful setting writes.

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


## Follow-up investigation: alternatives checked

Reviewed 2026-10-29. These findings do not establish a working complete recipe.

- **Protocol negotiation:** current libgphoto2 `ptp_sony_get_vendorpropcodes`
  requests Sony protocol 3.00 and selects mode 2 or 3 from the camera response.
  A different client cannot be assumed to unlock properties merely by requesting
  v3. This source review is of master, not a verified match to the installed
  libgphoto2 2.5.34 binary; the supplied inventory does not record the negotiated
  version. No claim is made that the user's camera was tested in every mode.
  https://github.com/gphoto/libgphoto2/blob/master/camlibs/ptp2/ptp.c
- **Third-party recipe examples:** pysonycam's example distinguishes full
  Creative Look recipes from older Creative Style selection. Its closest-style
  fallback maps multiple looks to the same style, and is not equivalent to
  sending the recipe's contrast, saturation and sharpness. It supplies no
  physical A6400 validation for this requirement.
  https://github.com/olkham/pysonycam/blob/main/examples/creative_look_recipes.py
- **Sony Camera Remote SDK:** the official supported-device list does not include
  ILCE-6400. It cannot be offered as an established drop-in solution here.
  https://support.d-imaging.sony.co.jp/app/sdk/en/
- **Sony Camera Remote Command:** this separate lower-level product does list
  ILCE-6400. Supported commands and transports are model-specific. The public
  remote-emulation announcement is not an A6400 menu-control guarantee. Sony
  explicitly corrected compatibility marks for commands that do not work on
  some models. The detailed command reference is available by application to
  corporate customers, not individual download; it was not obtained in this
  investigation. Model-level listing alone does not prove full recipe support.
  https://support.d-imaging.sony.co.jp/app/cameraremotecommand/en/index.html
- **Unknown properties and metadata:** numeric ranges and EXIF tag names do not
  identify writable remote settings. No speculative mapping or writes to D212,
  D236, or the failed D220 descriptor were introduced.

### Release gate

The missing evidence is a model-specific command or sequence for Creative Style,
contrast, saturation and sharpness, followed by physical write/readback of every
required recipe component. Neither a mock passing nor a successful APK build
can supply that evidence. No new APK or firmware modification is justified by
these findings. Full recipe application remains unfinished; this is a bounded
finding about the interfaces investigated, not proof of hardware impossibility.
