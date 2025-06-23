class WebRTCClient {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
    }

    async initialize() {
        try {
            if (this.peerConnection) {
                console.log("WebRTC already initialized");
                return true;
            }

            // Get local media stream
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });

            // Create peer connection
            this.peerConnection = new RTCPeerConnection(this.configuration);

            // Add local tracks
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Handle ICE candidates (SIP.js manages ICE internally)
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log("New ICE candidate (handled by SIP.js):", event.candidate);
                }
            };

            // ICE connection state changes
            this.peerConnection.oniceconnectionstatechange = () => {
                const state = this.peerConnection.iceConnectionState;
                console.log("ICE connection state:", state);
                this.updateConnectionStatus(state);
            };

            // Handle remote stream
            this.peerConnection.ontrack = (event) => {
                console.log("received remote track",event.track.kind);
                
                if (!this.remoteStream) {
                    this.remoteStream = new MediaStream();
                    const remoteAudio = document.getElementById('remoteAudio');
                    if (remoteAudio) {
                        remoteAudio.srcObject = this.remoteStream;
                    }
                    else{
                        console.log("no remote audio");
                        
                    }
                }
                event.streams[0].getTracks().forEach(track => {
                    this.remoteStream.addTrack(track);
                });
            };

            return true;
        } catch (error) {
            console.error('Error initializing WebRTC:', error);
            return false;
        }
    }

    async createOffer() {
        try {
            if (!this.peerConnection) throw new Error("PeerConnection not initialized");
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            return offer;
        } catch (error) {
            console.error('Error creating offer:', error);
            throw error;
        }
    }

    async handleAnswer(answer) {
        try {
            if (!this.peerConnection) throw new Error("PeerConnection not initialized");
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error('Error handling answer:', error);
            throw error;
        }
    }

    async handleOffer(offer) {
        try {
            if (!this.peerConnection) throw new Error("PeerConnection not initialized");
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            return answer;
        } catch (error) {
            console.error('Error handling offer:', error);
            throw error;
        }
    }

    async addIceCandidate(candidate) {
        try {
            if (!this.peerConnection) throw new Error("PeerConnection not initialized");
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
            throw error;
        }
    }

    updateConnectionStatus(status) {
        const statusElement = document.getElementById('callStatus');
        if (statusElement) {
            statusElement.textContent = `Connection: ${status}`;
        }
    }

    async hangup() {
        try {
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
            }

            if (this.peerConnection) {
                this.peerConnection.close();
            }

            this.localStream = null;
            this.remoteStream = null;
            this.peerConnection = null;

            const remoteAudio = document.getElementById('remoteAudio');
            if (remoteAudio) {
                remoteAudio.srcObject = null;
            }

        } catch (error) {
            console.error("Error during hangup:", error);
        }
    }

    getRemoteStream() {
        return this.remoteStream;
    }

    getLocalStream() {
        return this.localStream;
    }
}

// Export the WebRTCClient class
window.WebRTCClient = WebRTCClient;
