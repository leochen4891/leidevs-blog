---
title: "PTS timestamp is no longer my friend"
description: "Stored speeds were silently wrong by up to 50%: the camera's live-stream timestamps are fabricated, a firmware flaw proven with three cameras side by side. The fix ignores clocks entirely and times each pass by counting frames against a measured rate. Accuracy is now within 1-2 mph of camera-native ground truth."
pubDate: '2026-06-03'
heroImage: ../../assets/camwatch-pts-jump-pair.png
---

**TL;DR.** Stored speeds were silently wrong by up to 50%: the camera's live-stream timestamps are fabricated, a firmware flaw proven with three cameras side by side. The fix ignores clocks entirely and times each pass by counting frames against a measured rate. Accuracy is now within 1-2 mph of camera-native ground truth.

Follows [camwatch-1](/blog/camwatch/), [camwatch-2](/blog/camwatch-2/), [camwatch-3](/blog/camwatch-3/), and [camwatch-4](/blog/camwatch-4/).

## The symptom: phantoms in both directions

The per-frame PTS (presentation timestamp, the time label each video frame carries) was adopted early in this project precisely because it was the *stable* clock: on the first camera it beat frame arrival times comfortably. [Camwatch-4](/blog/camwatch-4/) already noted it got less stable after the camera swap, and switched the speed estimator to a running average that tolerates a few bad timestamps. On the current 4K camera that tolerance finally ran out.

![A frame from a recorded clip of a residential street in daylight. A dark SUV crosses the yellow measurement grid burned onto the road, outlined in red with a red trail of its tracked path. Top left, a burned-in label reads PTS time = 1123721.187s. Top center, the camera's wallclock reads 06/03/2026 11:03:24 am WED. Above the car, the stats label reads d=11.74 m, t=0.22 s, V=117.5 mph.](../../assets/camwatch-pts-phantom.png)

That overlay says a car covered 11.74 meters in 0.22 seconds on a residential street: 117 mph. The car was doing about 40. Worse, the errors go both ways and most of them are invisible:

- A burst of frames stamped milliseconds apart compresses the measured time, so the speed inflates. One pass stored **63.8 mph** for a car actually moving about 40, and tripped the speeding alarm.
- A fabricated gap stretches the measured time, so the speed deflates. One afternoon batch stored **16.5 mph** for a car actually moving about 35. Nothing flags a too-slow reading, so these passed silently for weeks.

## Ruling everything out

The obvious suspects each took an experiment to eliminate, measured on the live stream before and after every change:

**Recording mode, continuous vs event?**\
Burst persists.

**Codec, H.265 vs H.264?**\
Identical burst.

**Frame rate, 12 / 15 / 20 / 25 fps?**\
Identical burst.

**On-camera SD recording off?**\
Micro-clustering shrinks; the fabrication persists.

**The network?**\
0.36 ms ping, 0% loss. Ruled out.

**Our decoder?**\
Stock ffprobe sees the same scramble on the raw packets, and the timestamps before and after our decode are identical.

That last answer matters: a completely independent tool reading raw packets off the socket sees the same chaos, and decoding does not alter a single timestamp. The lie arrives over the wire.

## Two frames that solved it

The breakthrough came from putting two consecutive frames of one clip side by side. That pair is the hero image above, and it is worth a careful look:

- Both frames carry the same camera wallclock second, 09:53:50, so less than a second of real time separates them.
- The burned-in PTS jumps from 1119546.784 to 1119547.559: the stream claims **0.775 seconds** elapsed between consecutive frames.
- The car moved **1.07 meters**, which at its measured speed is one frame-step. Every other frame-to-frame step in this pass covers 0.8 to 1.5 meters, including steps the PTS claims took 12 milliseconds.

The car moves the same distance per frame whether the clock claims 12 milliseconds or 775. Constant displacement per frame is only possible if the frames are captured at a uniform real-time cadence, so the capture is fine and the timestamps are fiction. And the 1.07 m step rules out dropped frames: if eleven frames had actually been lost in that gap, the car would have jumped about 9 meters, not one car-length of one meter.

One observation, no extra hardware, and it splits the system cleanly: the geometry (the pixel-to-road-plane projection from [camwatch-2](/blog/camwatch-2/)) is trustworthy, and the clock is not.

## Measuring the true frame rate

If the PTS timestamps are no longer our friend, who is? The camera itself offers two honest clocks.

**The wallclock it prints onto every frame.** Counting frames between the on-screen second ticks gives the true rate, as long as a second is only counted when both of its boundary ticks are visible (a second cut off by the start or end of a clip gives a meaningless partial count).

![A dark chart titled Frames per camera-second, pass 13009, one cell per decoded frame with the second read from the burn-in wallclock. Three groups of cells: 8 gray cells labeled 11:03:23, clipped by clip start; 14 blue cells labeled 11:03:24, fully bounded; 13 gray cells labeled 11:03:25, clipped by clip end. Below, a real crop of the burn-in as printed on frame 15 reads 06/03/2026 11:03:24 am WED.](../../assets/camwatch-burnin-seconds.png)

Across 84 fully bounded seconds from 35 clips the count is 14 frames per second far more often than any other value. The camera is configured for "15 fps, constant". It does not honor that; the true rate is about 13.8.

**Its own SD-card recordings.** The camera records the same stream to its SD card and can upload each event over FTP. Those files carry clean, orderly timestamps: across every clip checked, not one frame pair sits closer than 25 milliseconds, and the average rate is 13.75 to 13.79 fps. The same camera that scrambles timestamps on its live stream writes honest ones to its own storage.

With all three generations of camera running side by side, the pattern localized the fault precisely:

| camera | live stream timestamps | own recordings |
|---|---|---|
| E1 (oldest) | clean, uniform 66.6 ms | clean |
| CX410W | mildly scrambled (4% of frames) | clean |
| CX810 (current, 4K) | heavily scrambled (23% of frames, gaps up to 0.9 s) | clean |

Two cameras stream the identical resolution and codec, yet one is clean and one is not. This is a per-model firmware flaw in the live-streaming path, amplified by the 4K encoding load, and no setting reaches it.

## The fix: count frames, don't read clocks

Everything needed for a trustworthy time base was already in the pipeline:

- The decoder numbers every received frame with a sequence number.
- The wall time those frames span is just their count divided by the received frame rate, which the capture process can measure for itself against the computer's own clock (a rolling one-minute average).

So the speed of a pass becomes:

```
elapsed = (last frame number - first frame number) / measured rate
speed   = trajectory distance / elapsed
```

A frame where the detector misses the car, or a frame the camera never sent, leaves a gap in the sequence numbers and correctly lengthens the elapsed time. The fabricated timestamps are simply never consulted.

Before trusting it, four candidate estimators were scored against ground truth: ten passes where the same car was also captured by the camera's honest SD recording, with the true speed computed from those recordings.

| estimator | mean error (mph) | worst |
|---|---|---|
| stored speeds (timestamp-based) | 6.2 | -13.0 |
| median step x rate | 1.0 | -2.3 |
| **total distance / (frames / rate)** | **0.7** | **+1.7** |
| same, with dropped-frame compensation | 1.5 | -4.1 |

Two things worth noticing. The boring estimator won: plain total distance over total inferred time, averaging across every frame. And the clever variant lost: explicitly detecting "this step is twice the median, a frame must have dropped" and adding time for it over-fires on legitimate motion variation, and made accuracy worse. True dropped frames are too rare (about 2% of steps) to pay for the false positives.

The old timing-based sanity guards came out at the same time. Only one guard survives: when a track's path doubles back on itself (two cars' tracks merging into one), the measured distance itself is corrupt, so the pass reports speed unknown no matter how plausible the number looks.

## Verification, and repairing the damage

The first passes after deployment landed within the validated band: against the camera's own recordings, the new speeds came out 1.4 and 2.7 mph high on the two cleanly comparable passes, versus stored errors of 9 to 13 mph on the same afternoon's traffic. The per-frame speed chart, which used to spike to 558 mph before decaying, now draws a flat converged line.

History got repaired too. Every not-yet-uploaded pass from the experiment window was recomputed offline using the frame count and the processing rate the metrics database had recorded at that minute (which correctly tracked the day's 12, 15, 20, and 25 fps experiments). Of 335 passes, 318 were recomputed, 31 of which had no speed at all before. **Half of them had been wrong by more than 5 mph**, including two false speeding alarms (42.7 that was really 27.8, and 49.7 that was really 25.5) and a car logged at 15.5 that was really doing 34.4.

The clip overlay was the last piece. It used to burn the PTS into every frame; now it burns the inputs of the new method, so any clip can be audited from its pixels alone:

![A frame from a new clip at dusk. A car crosses the yellow measurement grid on the road with a red bounding box and trail. Top left, the burned-in header reads seq=6303, grid+6, R=14.03fps. Top center, the camera wallclock reads 06/03/2026 09:03:38 pm WED. Above the car, the stats label reads d=6.06 m, t=0.43 s. Six frames since grid entry divided by 14.03 fps is exactly the 0.43 seconds shown.](../../assets/camwatch-cadence-overlay.png)

Frames since grid entry divided by the burned-in rate reproduces the elapsed time exactly, and the final in-grid frame's speed equals the stored headline. The overlay and the database can no longer disagree.

## Takeaways

**A timestamp is a sensor reading, not the truth.** It is produced by a stack of firmware with its own bugs, and it deserves the same skepticism as any other measurement. Before building math on a clock, check it against an independent reference. This system had two free ones all along: the wallclock the camera prints onto every frame, and the camera's own recordings of the same scene.

**When a sensor lies, find the invariant it cannot fake.** No log or setting revealed the fault. Two frames of one clip did, because a car at constant speed moves a constant distance per frame, and no firmware bug can forge physics. One cross-check between an honest channel (geometry) and a dishonest one (the clock) settled in a minute what hours of configuration changes could not.

**Validate estimators against ground truth, not against reasoning.** The dropped-frame compensation sounded strictly better and measured strictly worse. Without ten ground-truth passes to score against, the worse estimator would have shipped on the strength of a good argument.

**And a fun one: most of this was debugged from a car.** The majority of the investigation and the fix ran through a remote-controlled Claude session while I was out, sitting in a car with just a phone: probe that stream, compare those clips, run the shoot-out, deploy. Boris Cherny, the creator of Claude Code, has said he spends most of his time working from his phone, sending instructions to his agents. I can confirm it works really well.

## Conclusion

The camera stays; its streaming clock is simply no longer load-bearing. Speed now rests on two things the system can verify for itself, projected geometry and counted frames, and the camera's honest recordings remain on hand as an offline audit whenever the numbers deserve a spot check.
