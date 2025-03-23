let peer;
let localStream;
let connections = [];

async function joinRoom() {
  const room = document.getElementById("room").value.trim();
  if (!room) return alert("Enter a room name");

  document.getElementById("status").innerText = `🎤 Connecting to "${room}"...`;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("🎤 Got mic stream:", localStream);
  } catch (err) {
    console.error("🚫 Mic access denied:", err);
    document.getElementById("status").innerText = "🚫 Please allow mic access";
    return;
  }

  peer = new Peer(undefined, {
    host: location.hostname,
    port: location.port || 443,
    path: '/',
    secure: location.protocol === 'https:'
  });

  // Enhanced connection debugging
  console.log("🔧 PeerJS Config:", {
    host: location.hostname,
    port: location.port || 443,
    path: '/',
    secure: location.protocol === 'https:',
    url: `${location.protocol}//${location.hostname}${location.port ? ':' + location.port : ''}/`
  });

  peer.on("error", (error) => {
    console.error("❌ Peer error:", error);
    document.getElementById("status").innerText = `⚠️ Error: ${error.type}`;
  });

  peer.on("open", (id) => {
    console.log("✅ Connected with Peer ID:", id);
    document.getElementById("status").innerText = `🟢 Connected: ${id}`;

    // Add room to peer metadata
    fetch(`/join/${room}/${id}`, { method: 'POST' })
      .then(() => fetch("/peers"))
      .then(res => res.json())
      .then(peers => {
        peers.forEach(peerId => {
          if (peerId !== id) {
            const call = peer.call(peerId, localStream);
            handleCall(call);
          }
        });
      })
      .catch(err => {
        console.error("❌ Connection error:", err);
        document.getElementById("status").innerText = `⚠️ Connection failed`;
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

    // Show volume controls
    document.getElementById("controls").style.display = "block";

    // Setup volume control
    const slider = document.getElementById("volume");
    audio.volume = slider.value / 100;
    slider.oninput = (e) => {
      audio.volume = e.target.value / 100;
    };
  });

  call.on("error", (err) => {
    console.error("❌ Call error:", err);
    document.getElementById("status").innerText = `⚠️ Call error: ${err.type}`;
  });
}
