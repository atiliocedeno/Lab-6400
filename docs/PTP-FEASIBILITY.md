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
