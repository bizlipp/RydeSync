function generateRiffusionPlugin(riffusionURL, pluginName = "loopforge") {
  const idMatch = riffusionURL.match(/song\/([a-z0-9\-]+)/i);
  if (!idMatch) {
    alert("Invalid Riffusion link.");
    return null;
  }

  const songId = idMatch[1];
  const streamUrl = `https://public.riffusion.com/tracks/${songId}.mp3`;

  const pluginCode = `
// === /plugins/${pluginName}.js ===
export default {
  theme: '${pluginName}',
  title: '${pluginName.replace(/(^|\\s)\\S/g, t => t.toUpperCase())} – AI Generated Vibe',
  styles: '/themes/${pluginName}.css',
  musicLoop: true,
  allowMic: false,
  playlist: [
    {
      title: 'AI Track from Riffusion',
      url: '${streamUrl}'
    }
  ],
  components: ['waveform', 'now-playing', 'ai-visualizer']
};`;

  console.log(pluginCode);
  return pluginCode;
}
