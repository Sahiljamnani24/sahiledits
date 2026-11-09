# Remotion motion graphics experiment

Isolated render experiment; it is not connected to the public editor. Place an authorized source video at `public/source.mp4` and supply input props shaped as `{ "timeline": { ... } }`, with ordered source-time `clips` and `words`, plus output-time `graphics` and `zooms`. Render with `npx remotion render index.jsx SahilReel output.mp4 --props=/absolute/path/to/props.json`. The timeline can contain private transcript data; do not commit or publish it. Use Remotion under the applicable license.

The prototype demonstrates timed animated graphics, basic word captions, crop, cuts and zooms. It is not a finished AI editor, does not search or add music/B-roll, and may require human correction of speech and clip boundaries. Test the resulting MP4, including audio and cut timing, before any deployment.
