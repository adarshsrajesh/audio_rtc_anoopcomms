import {
  UserAgent,
  Registerer,
  Inviter,
  SessionState
} from "sip.js";

let userAgent;
let registerer;
let session;

// triggering function but not modified

// function modifyOpusFmtpModifier(sdp) {

//   console.log("inside mod_fun");
  
//   const lines = sdp.split('\r\n');

//   const opusRtpMapLineIndex = lines.findIndex(line =>
//     line.toLowerCase().startsWith('a=rtpmap') &&
//     line.toLowerCase().includes('opus/48000')
//   );

//   if (opusRtpMapLineIndex === -1) return Promise.resolve(sdp);

//   const opusPayloadMatch = lines[opusRtpMapLineIndex].match(/a=rtpmap:(\d+)\s+opus\/48000/i);
//   if (!opusPayloadMatch) return Promise.resolve(sdp);

//   const opusPayloadType = opusPayloadMatch[1];

//   const newFmtpParams = 'usedtx=1;useinbandfec=1;maxaveragebitrate=64000;maxplaybackrate=48000;minptime=10;ptime=10';
//   const fmtpLineIndex = lines.findIndex(line => line.startsWith(`a=fmtp:${opusPayloadType}`));

//   if (fmtpLineIndex !== -1) {
//     lines[fmtpLineIndex] = `a=fmtp:${opusPayloadType} ${newFmtpParams}`;
//   } else {
//     lines.splice(opusRtpMapLineIndex + 1, 0, `a=fmtp:${opusPayloadType} ${newFmtpParams}`);
//   }

//   const mAudioIndex = lines.findIndex(line => line.startsWith("m=audio"));
//   if (mAudioIndex !== -1) {
//     const parts = lines[mAudioIndex].split(" ");
//     const payloads = parts.slice(3);
//     const reordered = [opusPayloadType, ...payloads.filter(p => p !== opusPayloadType)];
//     lines[mAudioIndex] = [...parts.slice(0, 3), ...reordered].join(" ");
//   }

//   return Promise.resolve(lines.join('\r\n'));
// }



// test

function modifyOpusFmtpModifier(description) {
  console.log("inside mod_fun");

  const sdpString = typeof description === "string" ? description : description.sdp;
  const lines = sdpString.split('\r\n');

  const opusRtpMapLineIndex = lines.findIndex(line =>
    line.toLowerCase().startsWith('a=rtpmap') &&
    line.toLowerCase().includes('opus/48000')
  );

  if (opusRtpMapLineIndex === -1) return Promise.resolve(description);

  const opusPayloadMatch = lines[opusRtpMapLineIndex].match(/a=rtpmap:(\d+)\s+opus\/48000/i);
  if (!opusPayloadMatch) return Promise.resolve(description);

  const opusPayloadType = opusPayloadMatch[1];

  const newFmtpParams = 'usedtx=1;useinbandfec=1;maxaveragebitrate=48000;maxplaybackrate=8000;minptime=10;ptime=10';
  const fmtpLineIndex = lines.findIndex(line => line.startsWith(`a=fmtp:${opusPayloadType}`));

  if (fmtpLineIndex !== -1) {
    lines[fmtpLineIndex] = `a=fmtp:${opusPayloadType} ${newFmtpParams}`;
  } else {
    lines.splice(opusRtpMapLineIndex + 1, 0, `a=fmtp:${opusPayloadType} ${newFmtpParams}`);
  }

  const mAudioIndex = lines.findIndex(line => line.startsWith("m=audio"));
  if (mAudioIndex !== -1) {
    const parts = lines[mAudioIndex].split(" ");
    const payloads = parts.slice(3);
    const reordered = [opusPayloadType, ...payloads.filter(p => p !== opusPayloadType)];
    lines[mAudioIndex] = [...parts.slice(0, 3), ...reordered].join(" ");
  }

  const modifiedSdp = lines.join('\r\n');

  // Return same object structure if it was passed as an object
  if (typeof description === "object") {
    return Promise.resolve({
      type: description.type,
      sdp: modifiedSdp
    });
  } else {
    return Promise.resolve(modifiedSdp);
  }
}


const callBtn = document.getElementById("callBtn");
const hangupBtn = document.getElementById("hangupBtn");
const statusDiv = document.getElementById("status");
const callStatusDiv = document.getElementById("callStatus");
const remoteAudio = document.getElementById("remoteAudio");

// UI Helpers
function updateStatus(msg) {
  statusDiv.textContent = msg;
  console.log(msg);
}

function updateCallStatus(msg) {
  callStatusDiv.textContent = msg;
  console.log(msg);
}

function updateButtons({ registered = false, inCall = false }) {
  callBtn.disabled = !registered || inCall;
  hangupBtn.disabled = !inCall;
}

// ✅ SDP Modifier for Opus: modifies fmtp & prioritizes Opus in m=audio


// ✅ Register SIP
async function register() {
  const sipConfig = JSON.parse(localStorage.getItem("sipConfig"));
  if (!sipConfig || !sipConfig.username || !sipConfig.domain || !sipConfig.server || !sipConfig.password) {
    window.location.href = "login.html";
    return;
  }

  const uri = UserAgent.makeURI(`sip:${sipConfig.username}@${sipConfig.domain}`);
  if (!uri) {
    updateStatus("Invalid SIP URI");
    return;
  }

  userAgent = new UserAgent({
    uri,
    authorizationUsername: sipConfig.username,
    authorizationPassword: sipConfig.password,
    transportOptions: {
      server: `ws://${sipConfig.server}:5066/ws`
    },
    sessionDescriptionHandlerFactoryOptions: {
      peerConnectionConfiguration: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      },
      constraints: {
        audio: {
          sampleRate: 8000,
          channelCount: 1
        },
        video: false
      }
      // sessionDescriptionHandlerModifiers: [modifyOpusFmtpModifier]
    }
  });

  userAgent.delegate = {
    onInvite: async (invitation) => {
      session = invitation;
      const caller = session.remoteIdentity.uri.user;
      const acceptCall = confirm(`Incoming call from ${caller}. Accept?`);

      if (!acceptCall) {
        invitation.reject();
        updateCallStatus("Call rejected");
        session = null;
        return;
      }

      await session.accept({
   
          sessionDescriptionHandlerModifiers: [modifyOpusFmtpModifier]
        
      });

      bindSessionEvents(session);
    }
  };

  await userAgent.start();
  registerer = new Registerer(userAgent);
  await registerer.register();

  updateStatus("Registered successfully");
  updateButtons({ registered: true, inCall: false });
}

// ✅ Make a Call
async function makeCall() {
  const sipConfig = JSON.parse(localStorage.getItem("sipConfig"));
  const target = prompt("Enter the number to call:");

  if (!target || !/^[0-9]+$/.test(target)) {
    alert("Please enter a valid number.");
    return;
  }

  const targetURI = UserAgent.makeURI(`sip:${target}@${sipConfig.domain}`);
  if (!targetURI) {
    alert("Invalid target SIP URI");
    return;
  }

  session = new Inviter(userAgent, targetURI, {
      sessionDescriptionHandlerModifiers: [modifyOpusFmtpModifier]
  });

  await session.invite();
  updateCallStatus("Calling...");
  updateButtons({ registered: true, inCall: true });

  bindSessionEvents(session);
}

// ✅ Handle Call States
function bindSessionEvents(sess) {
  sess.stateChange.addListener((newState) => {
    switch (newState) {
      case SessionState.Establishing:
        updateCallStatus("Establishing call...");
        break;
      case SessionState.Established:
        handleEstablishedCall(sess);
        break;
      case SessionState.Terminated:
        handleCallEnded();
        break;
    }
  });
}

// ✅ Handle Media After Call is Established
async function handleEstablishedCall(sess) {
  const pc = sess.sessionDescriptionHandler.peerConnection;
  const remoteStream = new MediaStream();

  pc.getReceivers().forEach(receiver => {
    if (receiver.track && receiver.track.kind === 'audio') {
      remoteStream.addTrack(receiver.track);
    }
  });

  remoteAudio.srcObject = remoteStream;
  remoteAudio.autoplay = true;
  remoteAudio.playsInline = true;

  try {
    await remoteAudio.play();
  } catch (err) {
    console.warn("Autoplay blocked:", err);
  }

  pc.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      remoteAudio.srcObject = event.streams[0];
    }
  };

  updateCallStatus("Call in progress");
  updateButtons({ registered: true, inCall: true });

  setTimeout(async () => {
    console.log("Local SDP after modification:");
    console.log(pc.localDescription.sdp);

    const stats = await pc.getStats();
    stats.forEach(report => {
      if (report.type === "codec" && report.mimeType.toLowerCase().includes("opus")) {
        console.log(`Using codec: ${report.mimeType}, clockRate: ${report.clockRate}`);
      }
    });
  }, 3000);
}

// ✅ End the Call
async function hangup() {
  if (session) await session.bye();
  handleCallEnded();
}

function handleCallEnded() {
  updateCallStatus("Call ended");
  updateButtons({ registered: true, inCall: false });
  remoteAudio.srcObject = null;
  session = null;
}

// ✅ Cleanup on unload
window.addEventListener("beforeunload", async () => {
  if (session) await session.bye();
  if (registerer) await registerer.unregister();
  if (userAgent) await userAgent.stop();
});

// ✅ Attach events
callBtn.addEventListener("click", makeCall);
hangupBtn.addEventListener("click", hangup);

// ✅ Auto-register
register();

export { register, session, userAgent, makeCall, hangup };
