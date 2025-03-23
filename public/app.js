let peer;
let localStream;
let connections = [];

async function joinRoom() {
  const room = document.getElementById("room").value.trim();
  if (!room) return alert("Enter a room name");

  document.getElementById("status").innerText = `🎤 Connecting to "${room}"...`;

  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  console.log("🎤 Got mic stream:", localStream);

  peer = new Peer(undefined, {
    host: location.hostname,
    port: location.port || 443,
    path: '/',
    secure: location.protocol === 'https:',
    key: 'ridesync'
  });

  peer.on("open", (id) => {
    console.log("✅ Connected with Peer ID:", id);
    document.getElementById("status").innerText = `🟢 Connected: ${id}`;

    fetch("/peers")
      .then(res => res.json())
      .then(ids => {
        ids.forEach(p => {
          if (p !== id) {
            const call = peer.call(p, localStream);
            handleCall(call);
          }
        });
      });
  });

  peer.on("call", call => {
    call.answer(localStream);
    handleCall(call);
  });
}

function handleCall(call) {
  call.on("stream", remoteStream => {
    const audio = document.createElement("audio");
    audio.srcObject = remoteStream;
    audio.autoplay = true;
    document.body.appendChild(audio);
    connections.push(call);
  });
}
