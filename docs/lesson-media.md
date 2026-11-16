# Lesson media

Files used by lesson content (`lessons.content`, see `src/features/learn/blocks.ts`), served as static files at
`/media/…`. One folder per lesson. Until media uploads exist (FE-TCH-04, BE-MEDIA), new media is added here and
referenced by path; moving to object storage or a CDN later only changes the URLs in the content.

| Lesson | Files |
| --- | --- |
| `lessons/what-is-a-fraction/` | 24-second video: `master.m3u8` (HLS, H.264 360p + 240p and VP9 360p), `video.mp4` (fallback), `poster.jpg`, `captions.en.vtt`; `worksheet.pdf` |
| `lessons/equivalent-fractions/` | `fraction-wall.svg` (illustration) |

The sample video was drawn frame by frame (Python, Pillow, Lexend) and encoded with ffmpeg; the same commands
work for any video.

## Adding a video

Every video needs **captions** (WebVTT, `captions.<lang>.vtt`) and should have a transcript in its block: lessons
are for children, some of whom can't hear the audio or can't play sound in class.

```bash
IN=source.mp4; OUT=public/media/lessons/<lesson-slug>; mkdir -p $OUT

# 1. The MP4 fallback (and the source of the renditions)
ffmpeg -i $IN -c:v libx264 -pix_fmt yuv420p -crf 28 -c:a aac -b:a 64k -movflags +faststart $OUT/video.mp4

# 2. HLS renditions as fragmented MP4 (.m4s segments: never .ts, which TypeScript and linters try to read)
for spec in "640:360:360p:500k" "426:240:240p:250k"; do IFS=: read w h name br <<< "$spec"; mkdir -p $OUT/$name
  (cd $OUT/$name && ffmpeg -i ../video.mp4 -vf scale=$w:$h -c:v libx264 -pix_fmt yuv420p -profile:v main -b:v $br -maxrate $br -bufsize $br \
    -g 48 -keyint_min 48 -sc_threshold 0 -c:a aac -b:a 64k -hls_time 4 -hls_playlist_type vod \
    -hls_segment_type fmp4 -hls_fmp4_init_filename init.mp4 -hls_segment_filename "seg%03d.m4s" index.m3u8); done

# 3. A VP9 rendition, for browsers built without H.264 (open-source Chromium)
mkdir -p $OUT/360p-vp9 && (cd $OUT/360p-vp9 && ffmpeg -i ../video.mp4 -vf scale=640:360 -c:v libvpx-vp9 -b:v 400k -g 48 -row-mt 1 \
  -c:a libopus -b:a 48k -ar 48000 -hls_time 4 -hls_playlist_type vod -hls_segment_type fmp4 -hls_fmp4_init_filename init.mp4 \
  -hls_segment_filename "seg%03d.m4s" index.m3u8)

# 4. A poster (first frame, or any still)
ffmpeg -i $OUT/video.mp4 -frames:v 1 -q:v 4 $OUT/poster.jpg
```

Then write `master.m3u8` listing the renditions with their `CODECS` (players skip what they can't decode), as in
`lessons/what-is-a-fraction/master.m3u8`, and add a `video` block with `hls`, `mp4`, `poster`, `duration_seconds`,
`captions` and `transcript`.
