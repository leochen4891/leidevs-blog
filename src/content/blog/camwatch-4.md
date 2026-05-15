---
title: "A new camera for low-light hours"
description: "Captured images were often blurred in the early and late hours. Replaced the existing camera (E1 Outdoor, 1/2.8\" CMOS, f/1.6) with the CX410W (1/1.8\" CMOS, f/1.0), which is designed for low-light performance. Updated the speed measurement to d/t over an accumulating window inside the homography grid. Burned the grid and v=d/t overlay into recorded clips so each is self-contained."
pubDate: '2026-05-14'
heroImage: ../../assets/camwatch-night-passes.png
---

**TL;DR.** Captured images were often blurred in the early and late hours. Replaced the existing camera (E1 Outdoor, 1/2.8" CMOS, f/1.6) with the CX410W (1/1.8" CMOS, f/1.0), which is designed for low-light performance. Updated the speed measurement to d/t over an accumulating window inside the homography grid. Burned the grid and v=d/t overlay into recorded clips so each is self-contained.

Follows [camwatch-1](/blog/camwatch/), [camwatch-2](/blog/camwatch-2/), and [camwatch-3](/blog/camwatch-3/).

## The camera

The E1 Outdoor was sharp in good light but smeared moving cars at dawn and dusk. Auto-exposure cranks shutter time up to compensate for low light, and fast-moving subjects come out as elongated blurs. The shoulder hours were effectively a hole in the data for the vehicle enrichment pipeline (make, model, color), which needs sharp body lines to work.

The CX410W has a larger sensor and a wider aperture:

| | E1 Outdoor | CX410W |
|---|---|---|
| Sensor | 1/2.8" CMOS | 1/1.8" CMOS |
| Aperture | f/1.6 | f/1.0 |

A larger sensor catches more photons; a wider aperture admits more light per unit shutter time. Together they cut required shutter time enough that motion blur at dawn and dusk is gone, while the rest of the day stays sharp.

## The speed estimator

The new camera came with one downstream surprise: per-frame PTS timestamps are less stable than they were on the E1. We see bursts where five or six frames cluster near the same PTS, then the next frame jumps forward. The [trajectory-regression method](/blog/camwatch-2/) from camwatch-2 is sensitive to clustered outliers.

The replacement is an accumulating cumulative-distance-over-cumulative-time average:

- cum_dist += hypot(ΔX, ΔY) and cum_dt = t_i − t_0 from the first in-grid sample.
- Reports mph_i = (cum_dist / cum_dt) × MPH_PER_MPS at each frame; the final value is the headline.
- 0.5 m hysteresis on grid exit so a single border frame doesn't pop the average.

![Per-frame speed chart for pass 3886. The y-axis is mph from 10 to 90 with a label in the top left. The x-axis is the car's horizontal position in the frame, from south on the left to north on the right. Most per-frame samples sit tightly between 20 and 30 mph, with a few outlier dots in the 70 to 90 range. A smooth blue running-average line passes through the cluster at around 25 to 27 mph and ignores the outliers. A yellow marker labeled "27.1 mph" is highlighted on the line near the middle. Footer reads: pass 3886 N-bound, speed 26.49 mph, running_avg over 22 samples across 26 frames.](../../assets/camwatch-running-avg-chart.png)

Pass 3886 is a clean illustration. Most per-frame samples sit between 20 and 30 mph; a handful of PTS-burst outliers shoot up to 70+ mph. The running average passes through the well-behaved cluster and treats the outliers for what they are: a single bad sample is just a single bad sample, it can't rotate the line. The headline reads **26.49 mph**.

## Self-contained video clips

Recorded clips used to render the grid as a client-side overlay on top of the playback `<video>`. That worked when the live grid matched the clip's grid. After a camera swap or any recalibration, old clips replayed under the wrong overlay.

The fix is to burn the grid and the v=d/t overlay into the pixels of every new clip at write time, so the clip is self-evident at any future point. cv2.polylines for the grid, cv2.putText for the d / t / V block above the bounding box, cv2.circle for the trail.

![Single video frame of a silver hatchback heading south on a residential street, mid-morning light. The yellow homography grid is burned onto the road surface in front of the car, with a red trail tracing the car's bottom-center point through the grid. The bounding box around the car is in red. Top center: a black-background label reading "d=9.45 m  t=0.77 s" on the first line and "V=27.6 mph" on the second.](../../assets/camwatch-burnin-overlay.png)

Same information is in the clip as on the live dashboard, with no out-of-band state required.

## Low-light, before and after

![Two stacked grids comparing evening captures from each camera. Top, labeled BEFORE Old Camera 2026-05-13: thumbnails of cars at dusk are heavily motion-blurred with a strong magenta cast from the IR illuminator. Bottom, labeled AFTER New Camera 2026-05-14: same evening window, cars are sharp, true color, makes and models clearly readable. Both grids are center 50% crops at 2× zoom.](../../assets/camwatch-lowlight-comparison.jpg)

Same dusk window on two consecutive nights. The CX410W keeps body detail through low light; the E1 doesn't.

Pushing further into the night, pass 4070 at 08:58:38 PM (well past sunset, visually dark) is still producing a detected, color, speed-measured frame:

![Camwatch pass detail view at 08:58:38 PM on 2026-05-14, pass 4070 N-bound at 30 mph. Top: thumbnail of a dark SUV with bright headlights and a red taillight glow on a dim residential street, motion-blurred but in color. Middle: the burned-in video frame showing the road at night, yellow homography grid drawn on the road surface, red bounding box around the passing car, label reading "d=16.76 m  t=1.25 s  V=30.1 mph" on a black plate above the car. The camera's bottom-of-frame OSD reads "05/14/2026 08:58:37 pm THU". Bottom: speed chart with per-frame samples clustered tight around 30 mph and one outlier near 70 mph, the running_avg curve sits flat at 30 mph throughout, headline 30.28 mph over 18 samples across 22 frames.](../../assets/camwatch-after-sunset.png)

Motion blur on the body is real and the headlights bloom, but the car was still detected, tracked, and timed end to end. The running average lands at 30.28 mph.

---

Code: [github.com/leochen4891/camwatch](https://github.com/leochen4891/camwatch)
