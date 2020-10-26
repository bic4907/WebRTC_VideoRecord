'use strict';

const createExample = require('./lib/browser/example');

function switchLabel(label) {

    const connectingLabel = document.getElementById('connecting');
    const connectedLabel = document.getElementById('connected');
    const disconnectedLabel = document.getElementById('disconnected');

    connectingLabel.hidden = true;
    connectedLabel.hidden = true;
    disconnectedLabel.hidden = true;

    document.getElementById(label).hidden = false;
}

function logging(str) {
    const logs = document.getElementById('debug');
    logs.innerHTML += '<div>' + str + '</div>'

}



const localVideo = document.getElementById('video');
localVideo.autoplay = true;
localVideo.muted = true;

async function setIdleVideo() {
    navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
    }).then(function(stream) {
        localVideo.srcObject = stream;
    }, function(err) {
        alert('Could not acquire media: ' + err);
    });

}
setIdleVideo()


async function beforeAnswer(peerConnection) {

    let dataChannel = null;
    let healthCheckItv = null;

    function closeDatachannel() {
        if (dataChannel) {
            dataChannel.removeEventListener('message', onMessage);
            dataChannel.close();
            dataChannel = null;
        }
        if(healthCheckItv) {
            clearInterval(healthCheckItv)
        }
    }

    function onMessage({ data }) {

        if(data == 'video-ok') {
            switchLabel('connected')
            logging('Video Connected!')
        } else {
            console.log('pong - ', data)
            logging('pong - ' + data)
        }
    }

    function onDataChannel({ channel }) {
        logging('Channel on ' + channel.label)
        if (channel.label !== 'health-check') {
            return;
        }

        let count = 1000;

        // Slightly delaying everything because Firefox needs it
        setTimeout(() => {
            dataChannel = channel;
            dataChannel.addEventListener('message', onMessage);

            healthCheckItv = setInterval(function() {
                console.log('ping - ', count)
                logging('ping - ' + count)
                dataChannel.send(count)
                count += 1000;
            }, 1000)

        }, 200);




    }


    const localStream = await window.navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
    });

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    localVideo.srcObject = localStream;

    // NOTE(mroberts): This is a hack so that we can get a callback when the
    // RTCPeerConnection is closed. In the future, we can subscribe to
    // "connectionstatechange" events.
    const { close } = peerConnection;
    peerConnection.close = function() {
        console.log('PeerConnection Close')
        localStream.getTracks().forEach(track => track.stop());
        closeDatachannel();
        setIdleVideo()
        return close.apply(this, arguments);
    };

    peerConnection.addEventListener('datachannel', onDataChannel);
}

createExample( { beforeAnswer });

